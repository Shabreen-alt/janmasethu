import { Test, TestingModule } from '@nestjs/testing';
import { SeverityAnalysisService } from './severity-analysis.service';

describe('SeverityAnalysisService', () => {
  let service: SeverityAnalysisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SeverityAnalysisService],
    }).compile();

    service = module.get<SeverityAnalysisService>(SeverityAnalysisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return LOW severity for normal messages', () => {
    const result = service.evaluateSeverity('I would like to book an appointment for next week.');
    expect(result.score).toBe(0);
    expect(result.severity).toBe('GREEN');
  });

  it('should detect high risk keywords and return RED severity', () => {
    const result = service.evaluateSeverity('I have severe chest pain and I am coughing blood.');
    // chest pain (40) + coughing blood (45) = 85
    expect(result.score).toBeGreaterThan(70);
    expect(result.severity).toBe('RED');
    expect(result.flags).toContain('chest pain');
    expect(result.flags).toContain('coughing blood');
  });

  it('should apply cluster bonus for related symptoms', () => {
    const result = service.evaluateSeverity('I have a high fever and I feel very dizziness.');
    // high fever (25) + dizziness (20) + cluster bonus (15) = 60
    expect(result.score).toBe(60);
    expect(result.severity).toBe('YELLOW');
    expect(result.flags).toContain('CLUSTER: high fever + dizziness');
  });

  it('should cap the score at 100', () => {
    const result = service.evaluateSeverity('EMERGENCY! I have chest pain, shortness of breath, bleeding, and I am suicidal.');
    expect(result.score).toBe(100);
    expect(result.severity).toBe('RED');
  });

  it('should detect sentiment markers', () => {
    const result = service.evaluateSeverity('My condition is worsening immediately, help!');
    // worsening (10) + immediately (10) + help (10) = 30
    // Actually evaluation logic:
    // SENTIMENT_MARKERS: help, urgent, immediately, now, worsening, cannot breathe, intense
    // worsening (10) + immediately (10) + help (10) = 30
    expect(result.score).toBe(30);
    expect(result.severity).toBe('GREEN'); // 30 is the boundary for YELLOW (>30)
  });
});
