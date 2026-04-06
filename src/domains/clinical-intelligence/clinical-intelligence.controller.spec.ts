import { Test, TestingModule } from '@nestjs/testing';
import { ClinicalIntelligenceController } from './clinical-intelligence.controller';
import { ClinicalIntelligenceService } from './clinical-intelligence.service';

describe('ClinicalIntelligenceController', () => {
  let controller: ClinicalIntelligenceController;
  let service: ClinicalIntelligenceService;

  const mockInsight = {
    symptoms: [],
    risk_flags: [],
    urgency_level: 'low',
    summary: 'Test summary',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClinicalIntelligenceController],
      providers: [
        {
          provide: ClinicalIntelligenceService,
          useValue: {
            analyzeConversation: jest.fn().mockResolvedValue(mockInsight),
          },
        },
      ],
    }).compile();

    controller = module.get<ClinicalIntelligenceController>(ClinicalIntelligenceController);
    service = module.get<ClinicalIntelligenceService>(ClinicalIntelligenceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('analyzeConversation', () => {
    it('should call service for analysis', async () => {
      const conversation = 'Test conversation';
      const result = await controller.analyzeConversation(conversation, { user: { id: 'user-1' } });

      expect(result).toEqual(mockInsight);
      expect(service.analyzeConversation).toHaveBeenCalledWith(conversation, 'user-1');
    });

    it('should use anonymous if user info is missing', async () => {
      const conversation = 'Test conversation';
      await controller.analyzeConversation(conversation, {});

      expect(service.analyzeConversation).toHaveBeenCalledWith(conversation, 'anonymous');
    });
  });
});
