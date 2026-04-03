import { Module } from '@nestjs/common';
import { TemplateEngine } from './template.engine';
import { EngagementWorker } from './engagement.worker';

@Module({
  providers: [TemplateEngine, EngagementWorker],
  exports: [TemplateEngine],
})
export class EngagementModule {}
