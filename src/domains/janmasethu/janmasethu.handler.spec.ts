import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { JanmasethuHandler } from './janmasethu.handler';
import { JanmasethuRepository } from '../../infrastructure/repositories/janmasethu.repository';
import { SeverityAnalysisService } from './severity-analysis.service';
import { OwnershipManagerService } from './ownership-manager.service';

describe('JanmasethuHandler', () => {
  let handler: JanmasethuHandler;
  let repositoryMock: any;
  let severityMock: any;
  let ownershipMock: any;
  let queueMock: any;
  const testUserId = 'user-123';

  beforeEach(async () => {
    repositoryMock = {
      createMessage: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      getThreadById: jest.fn().mockResolvedValue({ id: 'thread-1', ownershipType: 'AI' }),
      updateThread: jest.fn().mockResolvedValue({ id: 'thread-1' }),
    };

    severityMock = {
      evaluateSeverity: jest.fn().mockReturnValue({ score: 0, severity: 'GREEN', flags: [] }),
    };

    ownershipMock = {
      canAiRespond: jest.fn().mockResolvedValue(true),
      transitionOwnership: jest.fn().mockResolvedValue({ id: 'thread-1' }),
    };

    queueMock = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      getJob: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JanmasethuHandler,
        {
          provide: JanmasethuRepository,
          useValue: repositoryMock,
        },
        {
          provide: SeverityAnalysisService,
          useValue: severityMock,
        },
        {
          provide: OwnershipManagerService,
          useValue: ownershipMock,
        },
        {
          provide: getQueueToken('sla_monitor'),
          useValue: queueMock,
        },
      ],
    }).compile();

    handler = module.get<JanmasethuHandler>(JanmasethuHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('handleIncomingMessage', () => {
    it('should escalate and notify professional on RED severity', async () => {
      severityMock.evaluateSeverity.mockReturnValueOnce({ score: 85, severity: 'RED', flags: ['chest pain'] });

      const result = await handler.handleIncomingMessage('thread-1', 'I have chest pain', 'patient-1', testUserId);

      expect(repositoryMock.createMessage).toHaveBeenCalledWith(expect.any(Object), testUserId);
      expect(ownershipMock.transitionOwnership).toHaveBeenCalledWith(
        'thread-1', 
        'HUMAN', 
        expect.stringContaining('chest pain'), 
        85
      );
      expect(queueMock.add).toHaveBeenCalled(); // Triggered scheduleSla
      expect(result.action).toBe('ESCALATED');
    });

    it('should suppress AI response if thread is under human control', async () => {
      ownershipMock.canAiRespond.mockResolvedValueOnce(false);

      const result = await handler.handleIncomingMessage('thread-1', 'How are you?', 'patient-1', testUserId);

      expect(repositoryMock.createMessage).toHaveBeenCalledWith(expect.any(Object), testUserId);
      expect(ownershipMock.transitionOwnership).not.toHaveBeenCalled();
      expect(result.action).toBe('HUMAN_IN_CONTROL');
    });

    it('should allow AI response for GREEN severity', async () => {
      const result = await handler.handleIncomingMessage('thread-1', 'Hello', 'patient-1', testUserId);

      expect(repositoryMock.createMessage).toHaveBeenCalledWith(expect.any(Object), testUserId);
      expect(repositoryMock.updateThread).toHaveBeenCalledWith('thread-1', { severity: 'GREEN' }, testUserId);
      expect(result.action).toBe('AI_RESPONSE');
    });
  });

  describe('updateThreadStatus (Hand-back)', () => {
    it('should hand-back to AI when status is STABLE and owner is HUMAN', async () => {
      repositoryMock.getThreadById.mockResolvedValueOnce({ id: 'thread-1', ownershipType: 'HUMAN' });

      await handler.updateThreadStatus('thread-1', 'STABLE', 'GREEN', testUserId);

      expect(ownershipMock.transitionOwnership).toHaveBeenCalledWith(
        'thread-1', 
        'AI', 
        expect.stringContaining('Case stabilized')
      );
      expect(repositoryMock.updateThread).toHaveBeenCalledWith('thread-1', expect.any(Object), testUserId);
    });

    it('should not hand-back if severity is RED', async () => {
      repositoryMock.getThreadById.mockResolvedValueOnce({ id: 'thread-1', ownershipType: 'HUMAN' });

      await handler.updateThreadStatus('thread-1', 'STABLE', 'RED', testUserId);

      expect(ownershipMock.transitionOwnership).not.toHaveBeenCalled();
    });
  });
});
