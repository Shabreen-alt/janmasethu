import { ClinicalIntelligenceService } from './clinical-intelligence.service';
import { InternalServerErrorException } from '@nestjs/common';

// Local mock for tracking calls to the model
let mockGenerateContent: jest.Mock;

jest.mock('async-retry', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(async (fn) => await fn(() => {})),
}));

describe('ClinicalIntelligenceService', () => {
  let service: ClinicalIntelligenceService;

  // Dependencies
  const mockEncryption = { 
    encrypt: jest.fn().mockImplementation(s => `enc_${s}`), 
    decrypt: jest.fn().mockImplementation(s => s.replace('enc_', '')) 
  };
  const mockAudit = { log: jest.fn() };
  const mockRepository = { saveAnalysis: jest.fn().mockResolvedValue({ id: 'analysis-123' }) };

  const mockInsight = {
    symptoms: [{ name: 'headache', severity: 'mild', duration: '2 days' }],
    risk_flags: ['None'],
    urgency_level: 'low',
    summary: 'Test summary',
  };

  beforeEach(() => {
    mockGenerateContent = jest.fn();
    // Manual instantiation with dependency injection (providing a mock for GEMINI_MODEL)
    service = new ClinicalIntelligenceService(
      mockEncryption as any,
      mockAudit as any,
      mockRepository as any,
      { generateContent: mockGenerateContent } as any,
    );

    // Silence logs during tests to keep console clean
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeConversation', () => {
    it('should successfully analyze a conversation, encrypt data, and persist results', async () => {
      const conversation = 'I have a slight headache.';
      
      // Setup the mock response exactly as the Gemini SDK would return it
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockInsight),
        },
      });

      const result = await service.analyzeConversation(conversation, 'user-123');

      // Verify the result matches our mock LLM output
      expect(result).toEqual(mockInsight);
      
      // Verify LLM orchestration
      expect(mockGenerateContent).toHaveBeenCalledWith(expect.stringContaining(conversation));
      
      // Verify encryption was used for security
      expect(mockEncryption.encrypt).toHaveBeenCalled();
      
      // Verify persistence and repository integration
      expect(mockRepository.saveAnalysis).toHaveBeenCalledWith(expect.objectContaining({
        urgency_level: 'low',
      }));
      
      // Verify audit logging for compliance
      expect(mockAudit.log).toHaveBeenCalledWith(
        'user-123',
        'CREATE',
        'MESSAGE',
        'analysis-123',
        expect.stringContaining('Urgency: low')
      );
    });

    it('should throw InternalServerErrorException if LLM returns malformed JSON', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Not valid JSON',
        },
      });

      await expect(service.analyzeConversation('hi')).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if LLM output does not match Zod schema', async () => {
      const invalidInsight = { symptoms: 'Should be an array' };
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(invalidInsight),
        },
      });

      await expect(service.analyzeConversation('hi')).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle LLM structure failures gracefully', async () => {
      // Simulating a case where response or response.text is missing
      mockGenerateContent.mockResolvedValue({
        response: null,
      });

      await expect(service.analyzeConversation('hi')).rejects.toThrow(InternalServerErrorException);
    });
  });
});
