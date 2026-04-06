import { Test, TestingModule } from '@nestjs/testing';
import { AlertingService } from './alerting.service';
import { getQueueToken } from '@nestjs/bullmq';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AlertTriggerRequest } from './alerting.schema';

describe('AlertingService', () => {
  let service: AlertingService;
  let mockAuditService: Partial<AuditService>;
  
  // To deal with the global fetch used in the STUB
  let originalFetch: any;

  beforeEach(async () => {
    originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    mockAuditService = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertingService,
        {
          provide: getQueueToken('webhook_dispatcher'),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken('patient_engagement'),
          useValue: { add: jest.fn() },
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<AlertingService>(AlertingService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processClinicalData', () => {
    it('should NOT trigger an alert for routine cases', async () => {
      const request: AlertTriggerRequest = {
        patient_id: '550e8400-e29b-41d4-a716-446655440000',
        symptoms: ['headache', 'fatigue'],
        risk_flags: [],
        urgency_level: 'low',
        timestamp: '2026-04-06T10:00:00Z',
      };

      const result = await service.processClinicalData(request);

      expect(result.triggered).toBe(false);
      expect(result.trace_id).toBeUndefined();
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('should TRIGGER an alert for critical urgency levels', async () => {
      const request: AlertTriggerRequest = {
        patient_id: '550e8400-e29b-41d4-a716-446655440000',
        symptoms: ['severe abdominal pain'],
        risk_flags: ['High Pain Index'],
        urgency_level: 'critical',
        timestamp: '2026-04-06T10:00:00Z',
      };

      const result = await service.processClinicalData(request);

      expect(result.triggered).toBe(true);
      expect(result.trace_id).toBeDefined();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        'system',
        'CREATE',
        'PATIENT',
        request.patient_id,
        expect.stringContaining('Emergency alert triggered')
      );
    });

    it('should TRIGGER an alert if dangerous risk flags are detected despite medium urgency', async () => {
      const request: AlertTriggerRequest = {
        patient_id: '550e8400-e29b-41d4-a716-446655440000',
        symptoms: ['feeling dizzy'],
        risk_flags: ['Possible Hemorrhage'], // Trigger keyword!
        urgency_level: 'medium',
        timestamp: '2026-04-06T10:00:00Z',
      };

      const result = await service.processClinicalData(request);

      expect(result.triggered).toBe(true);
      expect(result.trace_id).toBeDefined();
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should TRIGGER an alert if dangerous symptoms are detected', async () => {
      const request: AlertTriggerRequest = {
        patient_id: '550e8400-e29b-41d4-a716-446655440000',
        symptoms: ['patient is unconscious'], // Trigger keyword!
        risk_flags: [],
        urgency_level: 'low',
        timestamp: '2026-04-06T10:00:00Z',
      };

      const result = await service.processClinicalData(request);

      expect(result.triggered).toBe(true);
      expect(result.trace_id).toBeDefined();
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });
});
