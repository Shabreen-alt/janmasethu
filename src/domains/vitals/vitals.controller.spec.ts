import { Test, TestingModule } from '@nestjs/testing';
import { VitalsController } from './vitals.controller';
import { VitalsService } from './vitals.service';
import { BadRequestException } from '@nestjs/common';

describe('VitalsController', () => {
  let controller: VitalsController;
  let service: jest.Mocked<VitalsService>;

  beforeEach(async () => {
    const mockService = {
      processAndSaveVital: jest.fn(),
      getPatientVitals: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VitalsController],
      providers: [
        { provide: VitalsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<VitalsController>(VitalsController);
    service = module.get(VitalsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('addVital', () => {
    it('should successfully add a vital and return analysis', async () => {
      const validBody = {
        patient_id: '550e8400-e29b-41d4-a716-446655440000',
        vital_type: 'heart_rate',
        value: 70
      };
      const expectedResult = { status: 'normal', reason: 'Normal' };
      service.processAndSaveVital.mockResolvedValue(expectedResult as any);

      const result = await controller.addVital(validBody);

      expect(result).toEqual(expectedResult);
      expect(service.processAndSaveVital).toHaveBeenCalled();
    });

    it('should throw BadRequestException if Zod validation fails (e.g., bad BP format)', async () => {
      const invalidBody = {
        patient_id: '550e8400-e29b-41d4-a716-446655440000',
        vital_type: 'blood_pressure',
        value: 'not-a-bp'
      };

      await expect(controller.addVital(invalidBody)).rejects.toThrow(BadRequestException);
      expect(service.processAndSaveVital).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if vital_type is missing', async () => {
      const invalidBody = {
        patient_id: '550e8400-e29b-41d4-a716-446655440000',
        value: 120
      };

      await expect(controller.addVital(invalidBody)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getVitals', () => {
    it('should return patient vitals history', async () => {
      const patientId = '550e8400-e29b-41d4-a716-446655440000';
      const mockHistory = [{ id: '1', value: '70' }];
      service.getPatientVitals.mockResolvedValue(mockHistory as any);

      const result = await controller.getVitals(patientId);

      expect(result.data).toEqual(mockHistory);
      expect(service.getPatientVitals).toHaveBeenCalledWith(patientId);
    });
  });
});
