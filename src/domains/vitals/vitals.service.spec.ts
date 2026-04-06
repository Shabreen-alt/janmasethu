import { Test, TestingModule } from '@nestjs/testing';
import { VitalsService } from './vitals.service';
import { VitalsRepository } from './vitals.repository';
import { AlertingService } from '../alerting/alerting.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AddVitalRequest, VitalRecord } from './vitals.schema';
import { Logger } from '@nestjs/common';

describe('VitalsService', () => {
  let service: VitalsService;
  let repository: jest.Mocked<VitalsRepository>;
  let alertingService: jest.Mocked<AlertingService>;
  let auditService: jest.Mocked<AuditService>;

  beforeAll(() => {
    // Silence logs during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  beforeEach(async () => {
    const mockRepository = {
      saveVital: jest.fn(),
      getVitalsHistory: jest.fn(),
    };
    const mockAlertingService = {
      processClinicalData: jest.fn(),
    };
    const mockAuditService = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VitalsService,
        { provide: VitalsRepository, useValue: mockRepository },
        { provide: AlertingService, useValue: mockAlertingService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<VitalsService>(VitalsService);
    repository = module.get(VitalsRepository);
    alertingService = module.get(AlertingService);
    auditService = module.get(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processAndSaveVital', () => {
    const patientId = '550e8400-e29b-41d4-a716-446655440000';

    it('should correctly save a vital and return normal status if within range', async () => {
      const request: AddVitalRequest = {
        patient_id: patientId,
        vital_type: 'heart_rate',
        value: 75,
        recorded_at: new Date().toISOString(),
      };
      
      repository.saveVital.mockResolvedValue({ id: '1', ...request, created_at: new Date().toISOString() } as any);
      repository.getVitalsHistory.mockResolvedValue([]);

      const result = await service.processAndSaveVital(request);

      expect(result.status).toBe('normal');
      expect(repository.saveVital).toHaveBeenCalledWith(request);
      expect(alertingService.processClinicalData).not.toHaveBeenCalled();
    });

    it('should trigger high_risk alert for fever (temp > 38.0)', async () => {
      const request: AddVitalRequest = {
        patient_id: patientId,
        vital_type: 'temperature',
        value: 39.1,
        recorded_at: new Date().toISOString(),
      };

      repository.saveVital.mockResolvedValue({ id: '1', ...request, created_at: new Date().toISOString() } as any);
      repository.getVitalsHistory.mockResolvedValue([]);

      const result = await service.processAndSaveVital(request);

      expect(result.status).toBe('high_risk');
      expect(result.reason).toContain('Fever Detected');
      expect(alertingService.processClinicalData).toHaveBeenCalledWith(expect.objectContaining({
        urgency_level: 'critical',
        patient_id: patientId,
      }));
    });

    it('should trigger high_risk alert for high blood pressure (> 140/90)', async () => {
      const request: AddVitalRequest = {
        patient_id: patientId,
        vital_type: 'blood_pressure',
        value: '145/95',
        recorded_at: new Date().toISOString(),
      };

      repository.saveVital.mockResolvedValue({ id: '1', ...request, created_at: new Date().toISOString() } as any);
      repository.getVitalsHistory.mockResolvedValue([]);

      const result = await service.processAndSaveVital(request);

      expect(result.status).toBe('high_risk');
      expect(result.reason).toContain('High Blood Pressure');
    });

    it('should detect increasing trend in blood pressure over last 3 readings', async () => {
      const request: AddVitalRequest = {
        patient_id: patientId,
        vital_type: 'blood_pressure',
        value: '130/80',
        recorded_at: '2026-04-06T12:00:00Z',
      };

      const history: VitalRecord[] = [
        { id: '1', patient_id: patientId, vital_type: 'blood_pressure', value: '130/80', recorded_at: '2026-04-06T12:00:00Z', created_at: '' },
        { id: '2', patient_id: patientId, vital_type: 'blood_pressure', value: '120/80', recorded_at: '2026-04-06T11:00:00Z', created_at: '' },
        { id: '3', patient_id: patientId, vital_type: 'blood_pressure', value: '110/80', recorded_at: '2026-04-06T10:00:00Z', created_at: '' },
      ];

      repository.saveVital.mockResolvedValue(history[0]);
      repository.getVitalsHistory.mockResolvedValue(history);

      const result = await service.processAndSaveVital(request);

      expect(result.status).toBe('warning');
      expect(result.reason).toContain('Consecutive increase');
    });

    it('should detect increasing trend in weight over last 3 readings', async () => {
        const request: AddVitalRequest = {
          patient_id: patientId,
          vital_type: 'weight',
          value: 72,
          recorded_at: '2026-04-06T12:00:00Z',
        };
  
        const history: VitalRecord[] = [
          { id: '1', patient_id: patientId, vital_type: 'weight', value: '72', recorded_at: '2026-04-06T12:00:00Z', created_at: '' },
          { id: '2', patient_id: patientId, vital_type: 'weight', value: '71', recorded_at: '2026-04-06T11:00:00Z', created_at: '' },
          { id: '3', patient_id: patientId, vital_type: 'weight', value: '70', recorded_at: '2026-04-06T10:00:00Z', created_at: '' },
        ];
  
        repository.saveVital.mockResolvedValue(history[0]);
        repository.getVitalsHistory.mockResolvedValue(history);
  
        const result = await service.processAndSaveVital(request);
  
        expect(result.status).toBe('warning');
        expect(result.reason).toContain('Consecutive increase in weight');
      });
  });
});
