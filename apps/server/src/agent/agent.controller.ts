import { Body, Controller, Post } from '@nestjs/common';
import { AgentCommandDto } from './dto/agent-command.dto';
import { AgentService } from './agent.service';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('command')
  async command(@Body() dto: AgentCommandDto) {
    return this.agentService.handleCommand(dto);
  }
}
