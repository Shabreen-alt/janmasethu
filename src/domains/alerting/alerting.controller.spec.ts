import { Test, TestingModule } from '@nestjs/testing';
import { AlertingController } from './alerting.controller';
import { AlertingService } from './alerting.service';
import { InternalServerErrorException } from '@nestjs/common';

describe('AlertingController', () => {
  let controller: AlertingController;
  let mockService: Partial<AlertingService>;

  beforeEach(async () => {
    mockService = {
      processClinicalData: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertingController],
      providers: [
        { provide: AlertingService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<AlertingController>(AlertingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('triggerAlert', () => {
    it('should call processClinicalData and return response', async () => {
      const mockRequest = {
        patient_id: '550e8400-e29b-41d4-a716-446655440000',
        symptoms: ['headache'],
        risk_flags: [],
        urgency_level: 'low',
        timestamp: '2026-04-06T10:00:00Z',
      };
      const mockResponse = { triggered: false };
      (mockService.processClinicalData as jest.Mock).mockResolvedValue(mockResponse);

      const result = await controller.triggerAlert(mockRequest);

      expect(result).toEqual(mockResponse);
      expect(mockService.processClinicalData).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on validation or service failure', async () => {
      const invalidRequest = {
        patient_id: 'not-a-uuid', // Will fail Zod schema parse
      };

      await expect(controller.triggerAlert(invalidRequest)).rejects.toThrow(InternalServerErrorException);
      expect(mockService.processClinicalData).not.toHaveBeenCalled();
    });
    
    it('should throw InternalServerErrorException if service throws error', async () => {
      const validRequest = {
        patient_id: '550e8400-e29b-41d4-a716-446655440000',
        urgency_level: 'low'
      };
      
      (mockService.processClinicalData as jest.Mock).mockRejectedValue(new Error('Service Failed'));

      await expect(controller.triggerAlert(validRequest)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
