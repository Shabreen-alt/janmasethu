import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JanmasethuRepository } from '../../infrastructure/repositories/janmasethu.repository';
import { SeverityAnalysisService } from './severity-analysis.service';
import { OwnershipManagerService } from './ownership-manager.service';

@Injectable()
export class JanmasethuHandler {
  private readonly logger = new Logger(JanmasethuHandler.name);

  constructor(
    @InjectQueue('sla_monitor') private readonly slaQueue: Queue,
    private readonly repository: JanmasethuRepository,
    private readonly severityAnalysis: SeverityAnalysisService,
    private readonly ownershipManager: OwnershipManagerService
  ) {}

  /**
   * Main entry point for a patient interaction.
   * Handles storage, risk assessment, and ownership orchestration.
   */
  async handleIncomingMessage(threadId: string, content: string, senderId: string, userId: string = 'system'): Promise<any> {
    this.logger.log(`Processing incoming message for thread: ${threadId}`);

    // 1. Store the message (AES-256 Encrypted in repository)
    await this.repository.createMessage({
      threadId,
      senderType: 'PATIENT',
      senderId,
      content
    }, userId);

    // 2. Risk Assessment (Hybrid Engine)
    const { score, severity, flags } = this.severityAnalysis.evaluateSeverity(content);

    // 3. Ownership Logic
    const isHumanOwned = !(await this.ownershipManager.canAiRespond(threadId));

    if (severity === 'RED') {
      // Automatic Escalation Workflow
      this.logger.warn(`HIGH RISK detected (Score: ${score}). Triggering Escalation.`);
      await this.ownershipManager.transitionOwnership(
        threadId, 
        'HUMAN', 
        `High risk detected. Flags: ${flags.join(', ')}`, 
        score
      );
      
      // Schedule SLA for human intervention
      await this.scheduleSla(threadId, 'RED');
      
      return { 
        action: 'ESCALATED', 
        message: 'A medical professional has been notified due to the severity of your symptoms.' 
      };
    }

    if (isHumanOwned) {
      // AI Silence Enforcement
      this.logger.log(`Thread ${threadId} is currently under human control. AI guidance suppressed.`);
      return { 
        action: 'HUMAN_IN_CONTROL', 
        message: null // Handled by human
      };
    }

    // 4. Update severity on record if not already escalated
    await this.repository.updateThread(threadId, { severity }, userId);

    // AI allowed to respond
    return { 
      action: 'AI_RESPONSE', 
      score,
      severity
    };
  }

  /**
   * Schedules an SLA timeout job. Specifically acts on RED threads.
   * Runs in 5 minutes and will trigger worker execution unless cancelled.
   */
  async scheduleSla(threadId: string, severity: string): Promise<void> {
    if (severity !== 'RED') {
      return; // Only schedule strict timeouts for RED severity
    }
    
    // We explicitly name the job ID as the threadId so we can easily find/cancel it later
    await this.slaQueue.add(
      'red-sla-timeout',
      { threadId },
      { 
        jobId: `sla-${threadId}`, 
        delay: 5 * 60 * 1000 // 5 minutes in ms
      }
    );
    this.logger.log(`Scheduled 5-minute SLA timeout for RED thread ${threadId}`);
  }

  /**
   * Cancels any pending SLA job attached to this thread.
   */
  async cancelSla(threadId: string): Promise<void> {
    const job = await this.slaQueue.getJob(`sla-${threadId}`);
    if (job) {
      await job.remove();
      this.logger.log(`Cancelled SLA timeout for thread ${threadId} (Doctor responded)`);
    }
  }

  /**
   * State Machine logic for transitioning back to AI ownership (Hand-back).
   */
  async updateThreadStatus(threadId: string, status: string, severity: string, userId: string = 'system'): Promise<void> {
    const thread = await this.repository.getThreadById(threadId);
    if (!thread) return;

    let ownershipType = thread.ownershipType as 'AI' | 'HUMAN';
    
    // Hand-back Trigger: Status is STABLE/RESOLVED and severity is not RED
    if ((status === 'RESOLVED' || status === 'STABLE') && severity !== 'RED') {
      if (ownershipType === 'HUMAN') {
         await this.ownershipManager.transitionOwnership(
           threadId, 
           'AI', 
           `Case stabilized (Status: ${status}, Severity: ${severity})`
         );
         ownershipType = 'AI';
      }
    }

    await this.repository.updateThread(threadId, { status, severity, ownershipType }, userId);
    this.logger.log(`Updated thread ${threadId} to status: ${status}, severity: ${severity}, ownership: ${ownershipType}`);
    
    // If acknowledged by human, cancel any pending SLA timeouts
    if (status === 'ACKNOWLEDGED' || status === 'IN_PROGRESS') {
      await this.cancelSla(threadId);
    }
  }
}
