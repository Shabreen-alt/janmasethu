import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: process.env.USE_MOCK_REDIS === 'true' 
        ? new (require('ioredis-mock'))() 
        : {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
          },
    }),
    BullModule.registerQueue({
      name: 'sla_monitor',
    }),
    BullModule.registerQueue({
      name: 'patient_engagement',
    }),
    BullModule.registerQueue({
      name: 'webhook_dispatcher',
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
