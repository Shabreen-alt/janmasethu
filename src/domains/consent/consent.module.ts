import { Module } from '@nestjs/common';
import { ConsentController } from './consent.controller';
import { ConsentEnforcementService } from './consent-enforcement.service';
import { ConsentRepository } from './consent.repository';
import { EncryptionService } from '../../infrastructure/security/encryption.service';

@Module({
  controllers: [ConsentController],
  providers: [
    ConsentEnforcementService,
    ConsentRepository,
    EncryptionService,
  ],
  exports: [ConsentEnforcementService],
})
export class ConsentModule {}
