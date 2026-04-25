import { CanvasOpType } from '../realtime/op.types';

export interface ParsedIntent {
  type: CanvasOpType;
  content?: string;
}

export interface AgentGraphState {
  text: string;
  intent?: ParsedIntent;
}
