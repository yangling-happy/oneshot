// 操作处理 Web Worker，用于离线批量处理操作
export type CanvasOp = {
  id: string;
  type: "drawRectangle" | "drawArrow" | "addText";
  payload?: Record<string, unknown>;
  timestamp: number;
};

/**
 * 批量处理操作的工作线程
 * 可以在这里进行复杂的操作验证、冲突解决、数据转换等
 */
declare const self: Worker;

self.onmessage = (e: MessageEvent<{ ops: CanvasOp[] }>) => {
  try {
    const { ops } = e.data;

    // 示例：对操作进行去重和验证
    const seenIds = new Set<string>();
    const processedOps = ops.filter((op) => {
      if (seenIds.has(op.id)) return false;
      if (!op.id || !op.type) return false;
      seenIds.add(op.id);
      return true;
    });

    // 示例：按时间戳排序
    processedOps.sort((a, b) => a.timestamp - b.timestamp);

    // 回传处理结果
    self.postMessage({ processedOps });
  } catch (error) {
    console.error("Worker error processing ops:", error);
    self.postMessage({ processedOps: [] });
  }
};
