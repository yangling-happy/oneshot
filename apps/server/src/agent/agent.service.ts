import { Injectable } from '@nestjs/common';
import { agentGraph } from './agent.graph';
import { RealtimeService } from '../realtime/realtime.service';
import { CanvasOp } from '../realtime/op.types';
import { AgentCommandDto } from './dto/agent-command.dto';

@Injectable()
export class AgentService {
  constructor(private readonly realtimeService: RealtimeService) {}

  async handleCommand(dto: AgentCommandDto) {
    const docName = dto.docName ?? 'oneshot-canvas';
    const graphResult = await agentGraph.invoke({
      text: dto.text,
    });

    const intent = graphResult.intent;
    const now = Date.now();
    const op: CanvasOp = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      type: intent.type,
      payload: {
        text: intent.content ?? dto.text,
      },
      timestamp: now,
    };

    const totalOps = await this.realtimeService.appendOps(docName, [op]);
    return {
      status: 'accepted',
      docName,
      op,
      totalOps,
    };
  }
}
