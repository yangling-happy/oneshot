import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { MockWebhookController } from './mock-webhook.controller';

@Module({
  imports: [RealtimeModule],
  controllers: [AgentController, MockWebhookController],
  providers: [AgentService],
})
export class AgentModule {}
