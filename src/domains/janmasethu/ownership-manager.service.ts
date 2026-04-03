import { Injectable, Logger } from '@nestjs/common';
import { JanmasethuRepository, Thread } from '../../infrastructure/repositories/janmasethu.repository';

@Injectable()
export class OwnershipManagerService {
  private readonly logger = new Logger(OwnershipManagerService.name);

  constructor(private readonly repository: JanmasethuRepository) {}

  /**
   * Orchestrates the transition of ownership between AI and Human.
   * Logic:
   * - AI -> HUMAN: Escalation due to high severity.
   * - HUMAN -> AI: Hand-back due to stabilization or case resolution.
   */
  async transitionOwnership(
    threadId: string, 
    newOwner: 'AI' | 'HUMAN', 
    reason: string, 
    score?: number
  ): Promise<Thread | null> {
    const thread = await this.repository.getThreadById(threadId);
    if (!thread) {
      this.logger.error(`Cannot transition ownership: Thread ${threadId} not found.`);
      return null;
    }

    if (thread.ownershipType === newOwner) {
      this.logger.debug(`Thread ${threadId} already owned by ${newOwner}. Skipping transition.`);
      return thread; // No change needed
    }

    this.logger.log(`TRANSITION: Thread ${threadId} moving from ${thread.ownershipType} to ${newOwner}. Reason: ${reason}`);

    // Update the thread state
    const updatedThread = await this.repository.updateThread(threadId, {
      ownershipType: newOwner,
      status: newOwner === 'HUMAN' ? 'ESCALATED' : 'STABLE'
    });

    // Create an audit trail record
    await this.repository.createAuditLog({
      threadId,
      fromOwner: thread.ownershipType,
      toOwner: newOwner,
      reason,
      severityScore: score
    });

    return updatedThread;
  }

  /**
   * Helper to check if AI is currently allowed to respond.
   */
  async canAiRespond(threadId: string): Promise<boolean> {
    const thread = await this.repository.getThreadById(threadId);
    return thread?.ownershipType === 'AI';
  }
}
