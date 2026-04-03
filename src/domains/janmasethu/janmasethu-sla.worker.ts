import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JanmasethuRepository } from '../../infrastructure/repositories/janmasethu.repository';

@Processor('sla_monitor')
export class JanmasethuSlaWorker extends WorkerHost {
  private readonly logger = new Logger(JanmasethuSlaWorker.name);

  constructor(private readonly repository: JanmasethuRepository) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'red-sla-timeout': {
        const { threadId } = job.data;
        this.logger.warn(`SLA EXPIRED! Thread ${threadId} has gone unattended for >5 mins.`);
        
        // 1. Double check the DB to ensure it's still RED and hasn't been acknowledged recently
        const thread = await this.repository.getThreadById(threadId);
        
        if (thread && thread.status !== 'ACKNOWLEDGED' && thread.severity === 'RED') {
          // 2. Perform SLA escalations
          this.logger.error(`ESCALATION REQUIRED: Notifying Chief Resident Officer (CRO) for thread ${threadId}`);
          
          await this.repository.updateThread(threadId, {
            assignedClinicianId: null, // Nullify ownership
            queue: 'GENERAL', // Kick back to general queue
          });

          this.logger.log(`Thread ${threadId} ownership revoked and kicked to GENERAL queue.`);
        } else {
            this.logger.log(`False alarm: Thread ${threadId} resolved itself right at the buzzer. Skipping escalation.`);
        }

        return {};
      }
      default:
        this.logger.warn(`Received unknown job name in sla_monitor: ${job.name}`);
        return {};
    }
  }
}
