import { Body, Controller, Post } from '@nestjs/common';
import { AgentService } from './agent.service';

interface MockWebhookBody {
  text?: string;
  docName?: string;
}

@Controller('mock')
export class MockWebhookController {
  constructor(private readonly agentService: AgentService) {}

  @Post('feishu')
  async receive(@Body() body: MockWebhookBody) {
    return this.agentService.handleCommand({
      text: body.text ?? '画一个矩形',
      docName: body.docName,
    });
  }
}
