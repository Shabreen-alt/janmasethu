import { Module } from '@nestjs/common';
import { DatabaseModule } from './infrastructure/database.module';
import { QueueModule } from './infrastructure/queue.module';
import { AuditModule } from './infrastructure/audit/audit.module';
import { JanmasethuModule } from './domains/janmasethu/janmasethu.module';
import { EngagementModule } from './domains/engagement/engagement.module';

@Module({
  imports: [
    DatabaseModule, 
    QueueModule, 
    AuditModule, 
    JanmasethuModule, 
    EngagementModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
