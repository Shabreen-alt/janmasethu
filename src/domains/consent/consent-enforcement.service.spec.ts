import { ConsentEnforcementService } from './consent-enforcement.service';
import { ConsentRepository } from './consent.repository';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { ConsentPreferences } from './consent.schema';
import { Logger } from '@nestjs/common';

describe('ConsentEnforcementService', () => {
  let service: ConsentEnforcementService;
  let mockRepository: Partial<ConsentRepository>;
  let mockAudit: Partial<AuditService>;

  const patientId = '550e8400-e29b-41d4-a716-446655440000';
  
  const mockPreferences: ConsentPreferences = {
    allowed_channels: { sms: true, whatsapp: true, email: false, call: false },
    allowed_message_types: ['alert', 'reminder'],
    quiet_hours: { start_time: '22:00', end_time: '07:00' }
  };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    mockRepository = {
      getConsentByPatientId: jest.fn().mockResolvedValue(mockPreferences),
    };
    mockAudit = {
      log: jest.fn(),
    };
    service = new ConsentEnforcementService(
      mockRepository as ConsentRepository,
      mockAudit as AuditService,
    );
  });

  describe('checkConsent', () => {
    it('should grant permission for allowed channel and type during day', async () => {
      const result = await service.checkConsent({
        patient_id: patientId,
        communication_channel: 'sms',
        message_type: 'alert',
        urgency_level: 'low',
        timestamp: '2026-04-06T10:00:00Z' // 10:00 AM (Day)
      });

      expect(result.allowed).toBe(true);
      expect(result.overridden).toBe(false);
    });

    it('should deny permission for disabled channel', async () => {
      const result = await service.checkConsent({
        patient_id: patientId,
        communication_channel: 'email',
        message_type: 'alert',
        urgency_level: 'low',
        timestamp: '2026-04-06T10:00:00Z'
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Channel 'email' is explicitly disabled");
    });

    it('should deny permission for disabled message type', async () => {
      const result = await service.checkConsent({
        patient_id: patientId,
        communication_channel: 'whatsapp',
        message_type: 'update',
        urgency_level: 'low',
        timestamp: '2026-04-06T10:00:00Z'
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Message type 'update' is not in the allowed list");
    });

    it('should deny permission during quiet hours', async () => {
      const result = await service.checkConsent({
        patient_id: patientId,
        communication_channel: 'whatsapp',
        message_type: 'alert',
        urgency_level: 'medium',
        timestamp: '2026-04-06T23:00:00Z' // 11:00 PM (Quiet Hours)
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("within patient's quiet hours");
    });

    it('should override quiet hours for critical urgency', async () => {
      const result = await service.checkConsent({
        patient_id: patientId,
        communication_channel: 'whatsapp',
        message_type: 'alert',
        urgency_level: 'critical',
        timestamp: '2026-04-06T23:00:00Z'
      });

      expect(result.allowed).toBe(true);
      expect(result.overridden).toBe(true);
      expect(result.reason).toContain("Emergency override");
    });

    it('should still deny disabled channel even for critical urgency', async () => {
      const result = await service.checkConsent({
        patient_id: patientId,
        communication_channel: 'call',
        message_type: 'alert',
        urgency_level: 'critical',
        timestamp: '2026-04-06T23:00:00Z'
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Channel 'call' is explicitly disabled");
    });

    it('should deny by default if no consent record found', async () => {
      (mockRepository.getConsentByPatientId as jest.Mock).mockResolvedValue(null);

      const result = await service.checkConsent({
        patient_id: patientId,
        communication_channel: 'sms',
        message_type: 'alert',
        urgency_level: 'low',
        timestamp: '2026-04-06T10:00:00Z'
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("No consent record found");
    });
  });
});
