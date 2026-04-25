export type CanvasOpType = 'drawRectangle' | 'drawArrow' | 'addText';

export type CanvasOpPayload = Record<string, unknown>;

export interface CanvasOp {
  id: string;
  type: CanvasOpType;
  payload: CanvasOpPayload;
  timestamp: number;
}
