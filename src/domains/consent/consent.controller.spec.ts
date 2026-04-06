import { Test, TestingModule } from '@nestjs/testing';
import { ConsentController } from './consent.controller';
import { ConsentEnforcementService } from './consent-enforcement.service';
import { ConsentCheckRequest, ConsentSaveRequest } from './consent.schema';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';

describe('ConsentController', () => {
  let controller: ConsentController;
  let mockService: Partial<ConsentEnforcementService>;

  const patientId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    mockService = {
      checkConsent: jest.fn(),
      saveConsent: jest.fn(),
      repository: {
        getConsentByPatientId: jest.fn(),
      }
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsentController],
      providers: [
        { provide: ConsentEnforcementService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<ConsentController>(ConsentController);
  });

  describe('checkConsent', () => {
    it('should call service.checkConsent and return response', async () => {
      const mockRequest: ConsentCheckRequest = {
        patient_id: patientId,
        communication_channel: 'sms',
        message_type: 'alert',
        urgency_level: 'low',
        timestamp: '2026-04-06T10:00:00Z',
      };
      const mockResponse = { allowed: true, reason: 'Allowed', overridden: false };
      (mockService.checkConsent as jest.Mock).mockResolvedValue(mockResponse);

      const result = await controller.checkConsent(mockRequest);

      expect(result).toEqual(mockResponse);
      expect(mockService.checkConsent).toHaveBeenCalledWith(mockRequest);
    });

    it('should throw InternalServerErrorException on service failure', async () => {
      (mockService.checkConsent as jest.Mock).mockRejectedValue(new Error('Logic Error'));

      await expect(controller.checkConsent({} as any)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getConsent', () => {
    it('should return preferences from repository', async () => {
      const mockPrefs = { allowed_channels: { sms: true } };
      (mockService['repository'].getConsentByPatientId as jest.Mock).mockResolvedValue(mockPrefs);

      const result = await controller.getConsent(patientId);

      expect(result).toEqual(mockPrefs);
    });

    it('should throw NotFoundException if preferences not found', async () => {
      (mockService['repository'].getConsentByPatientId as jest.Mock).mockResolvedValue(null);

      await expect(controller.getConsent(patientId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateConsent', () => {
    it('should call service.saveConsent and return success', async () => {
      const mockSaveRequest: ConsentSaveRequest = {
        patient_id: patientId,
        preferences: { 
            allowed_channels: { sms: true, whatsapp: true, email: true, call: true },
            allowed_message_types: ['alert'],
            quiet_hours: { start_time: '23:00', end_time: '06:00' }
        }
      };
      (mockService.saveConsent as jest.Mock).mockResolvedValue(true);

      const result = await controller.updateConsent(mockSaveRequest);

      expect(result).toEqual({ success: true });
      expect(mockService.saveConsent).toHaveBeenCalledWith(patientId, mockSaveRequest.preferences);
    });

    it('should throw InternalServerErrorException on service failure', async () => {
      (mockService.saveConsent as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await expect(controller.updateConsent({} as any)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
