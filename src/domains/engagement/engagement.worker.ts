import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TemplateEngine } from './template.engine';
import { ConsentEnforcementService } from '../consent/consent-enforcement.service';

@Processor('patient_engagement')
export class EngagementWorker extends WorkerHost {
  private readonly logger = new Logger(EngagementWorker.name);

  constructor(
    private readonly templateEngine: TemplateEngine,
    private readonly consentEnforcement: ConsentEnforcementService
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'push-whatsapp': {
        const { rawTemplate, variables, phone } = job.data;
        
        // 1. Build the personalized message
        const finalMessage = this.templateEngine.parseTemplate(rawTemplate, variables);
        this.logger.log(`Parsed Template: "${finalMessage}"`);

        // 2. Consent Enforcement Check
        const consent = await this.consentEnforcement.checkConsent({
          patient_id: job.data.patientId || '00000000-0000-0000-0000-000000000000', // Fallback for stub
          communication_channel: 'whatsapp',
          message_type: job.data.messageType || 'update',
          urgency_level: job.data.urgencyLevel || 'low',
          timestamp: new Date().toISOString(),
        });

        if (!consent.allowed) {
          this.logger.warn(`[WHATSAPP-BLOCKED] ${consent.reason}`);
          return { delivered: false, reason: consent.reason };
        }

        // 3. Dispatch to hypothetical WhatsApp API
        // WARNING: WhatsApp functionality stub
        this.logger.log(`[WHATSAPP-STUB] Dispatching message to ${phone}... [SUCCESS]`);

        return { delivered: true, message: finalMessage };
      }
      default:
        this.logger.warn(`Received unknown job name in patient_engagement: ${job.name}`);
        return {};
    }
  }
}
