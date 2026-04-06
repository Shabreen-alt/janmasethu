import { Module } from '@nestjs/common';
import { DatabaseModule } from './infrastructure/database.module';
import { QueueModule } from './infrastructure/queue.module';
import { AuditModule } from './infrastructure/audit/audit.module';
import { JanmasethuModule } from './domains/janmasethu/janmasethu.module';
import { EngagementModule } from './domains/engagement/engagement.module';
import { ClinicalIntelligenceModule } from './domains/clinical-intelligence/clinical-intelligence.module';
import { ConsentModule } from './domains/consent/consent.module';
import { AlertingModule } from './domains/alerting/alerting.module';
import { VitalsModule } from './domains/vitals/vitals.module';

@Module({
  imports: [
    DatabaseModule, 
    QueueModule, 
    AuditModule, 
    JanmasethuModule, 
    EngagementModule,
    ClinicalIntelligenceModule,
    ConsentModule,
    AlertingModule,
    VitalsModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
