import { Module } from '@nestjs/common';
import { TemplateEngine } from './template.engine';
import { EngagementWorker } from './engagement.worker';
import { ConsentModule } from '../consent/consent.module';

@Module({
  imports: [ConsentModule],
  providers: [TemplateEngine, EngagementWorker],
  exports: [TemplateEngine],
})
export class EngagementModule {}
