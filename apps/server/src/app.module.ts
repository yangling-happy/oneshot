import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RealtimeModule } from './realtime/realtime.module';
import { AgentModule } from './agent/agent.module';

@Module({
  imports: [RealtimeModule, AgentModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
