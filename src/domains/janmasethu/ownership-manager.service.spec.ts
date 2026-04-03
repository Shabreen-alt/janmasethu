import { Test, TestingModule } from '@nestjs/testing';
import { OwnershipManagerService } from './ownership-manager.service';
import { JanmasethuRepository, Thread } from '../../infrastructure/repositories/janmasethu.repository';

describe('OwnershipManagerService', () => {
  let service: OwnershipManagerService;
  let repositoryMock: any;

  const mockThread: Thread = {
    id: 'thread-1',
    patientId: 'patient-1',
    queue: 'GENERAL',
    status: 'PENDING',
    severity: 'GREEN',
    ownershipType: 'AI'
  };

  beforeEach(async () => {
    repositoryMock = {
      getThreadById: jest.fn().mockResolvedValue(mockThread),
      updateThread: jest.fn().mockImplementation((id, updates) => Promise.resolve({ ...mockThread, ...updates })),
      createAuditLog: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnershipManagerService,
        {
          provide: JanmasethuRepository,
          useValue: repositoryMock,
        },
      ],
    }).compile();

    service = module.get<OwnershipManagerService>(OwnershipManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('transitionOwnership', () => {
    it('should transition from AI to HUMAN and create an audit log', async () => {
      const result = await service.transitionOwnership('thread-1', 'HUMAN', 'High severity detected', 85);

      expect(repositoryMock.updateThread).toHaveBeenCalledWith('thread-1', {
        ownershipType: 'HUMAN',
        status: 'ESCALATED'
      });
      expect(repositoryMock.createAuditLog).toHaveBeenCalledWith({
        threadId: 'thread-1',
        fromOwner: 'AI',
        toOwner: 'HUMAN',
        reason: 'High severity detected',
        severityScore: 85
      });
      expect(result.ownershipType).toBe('HUMAN');
    });

    it('should transition from HUMAN to AI when stabilized', async () => {
      // Setup current state as HUMAN
      repositoryMock.getThreadById.mockResolvedValueOnce({ ...mockThread, ownershipType: 'HUMAN' });

      const result = await service.transitionOwnership('thread-1', 'AI', 'Case stabilized');

      expect(repositoryMock.updateThread).toHaveBeenCalledWith('thread-1', {
        ownershipType: 'AI',
        status: 'STABLE'
      });
      expect(repositoryMock.createAuditLog).toHaveBeenCalledWith({
        threadId: 'thread-1',
        fromOwner: 'HUMAN',
        toOwner: 'AI',
        reason: 'Case stabilized',
        severityScore: undefined
      });
      expect(result.ownershipType).toBe('AI');
    });

    it('should not transition if new owner is the same as current owner', async () => {
      const result = await service.transitionOwnership('thread-1', 'AI', 'No change');

      expect(repositoryMock.updateThread).not.toHaveBeenCalled();
      expect(repositoryMock.createAuditLog).not.toHaveBeenCalled();
      expect(result.ownershipType).toBe('AI');
    });
  });

  describe('canAiRespond', () => {
    it('should return true if owner is AI', async () => {
      const result = await service.canAiRespond('thread-1');
      expect(result).toBe(true);
    });

    it('should return false if owner is HUMAN', async () => {
      repositoryMock.getThreadById.mockResolvedValueOnce({ ...mockThread, ownershipType: 'HUMAN' });
      const result = await service.canAiRespond('thread-1');
      expect(result).toBe(false);
    });
  });
});
