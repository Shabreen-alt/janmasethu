import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JanmasethuHandler } from './janmasethu.handler';
import { JanmasethuSlaWorker } from './janmasethu-sla.worker';
import { JanmasethuRepository } from '../../infrastructure/repositories/janmasethu.repository';
import { JanmasethuController } from './janmasethu.controller';
import { EncryptionService } from '../../infrastructure/security/encryption.service';
import { SeverityAnalysisService } from './severity-analysis.service';
import { OwnershipManagerService } from './ownership-manager.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'sla_monitor',
    }),
    BullModule.registerQueue({
      name: 'patient_engagement',
    }),
  ],
  controllers: [JanmasethuController],
  providers: [
    JanmasethuHandler, 
    JanmasethuSlaWorker, 
    JanmasethuRepository, 
    EncryptionService,
    SeverityAnalysisService,
    OwnershipManagerService
  ],
  exports: [JanmasethuHandler, JanmasethuRepository],
})
export class JanmasethuModule {}
