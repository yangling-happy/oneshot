import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { Tldraw, createShapeId, type Editor } from "@tldraw/tldraw";
import * as Y from "yjs";
import { inflate } from "pako";
import "@tldraw/tldraw/tldraw.css";
import "./App.css";

type CanvasOp = {
  id: string;
  type: "drawRectangle" | "drawArrow" | "addText";
  payload?: Record<string, unknown>;
  timestamp: number;
};

// Web Worker 用于离线处理大量操作
const opWorker = new Worker(
  new URL("./op-processor.worker.ts", import.meta.url),
  { type: "module" },
);

function App() {
  const [status, setStatus] = useState("connecting");
  const [opsCount, setOpsCount] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const appliedOpIds = useRef(new Set<string>());
  const pendingOps = useRef<CanvasOp[]>([]);
  const isApplying = useRef(false);

  const ydoc = useMemo(() => new Y.Doc(), []);
  const provider = useMemo(() => {
    return new HocuspocusProvider({
      url: "ws://localhost:1234",
      name: "oneshot-canvas",
      document: ydoc,
      // 自定义消息处理，支持压缩更新
      onMessage: (data: any) => {
        try {
          const messageType = data.data ? data.data[0] : data[0];

          // 处理压缩的增量更新
          if (messageType === 1) {
            const startTime = performance.now();
            const compressedData = (data.data || data).slice(1);
            const decompressed = inflate(compressedData);
            Y.applyUpdate(ydoc, decompressed);
            setLatency(Math.round(performance.now() - startTime));
            return false; // 阻止默认处理
          }
          // 默认消息类型0，保持原有处理逻辑
          return true;
        } catch (error) {
          console.error("Failed to process message:", error);
          return true;
        }
      },
    });
  }, [ydoc]);

  // 批量应用操作，使用 requestIdleCallback 避免阻塞主线程
  const applyPendingOps = useCallback(() => {
    if (isApplying.current || pendingOps.current.length === 0) return;

    isApplying.current = true;

    requestIdleCallback((deadline) => {
      const editor = editorRef.current;
      if (!editor) {
        isApplying.current = false;
        return;
      }

      const opsToApply = [];

      // 在空闲时间内尽可能多的处理操作
      while (deadline.timeRemaining() > 0 && pendingOps.current.length > 0) {
        const op = pendingOps.current.shift()!;
        if (!appliedOpIds.current.has(op.id)) {
          appliedOpIds.current.add(op.id);
          opsToApply.push(op);
        }
      }

      if (opsToApply.length > 0) {
        const shapes = opsToApply.map((op, index) => {
          const baseX =
            200 + (appliedOpIds.current.size - opsToApply.length + index) * 24;
          const baseY =
            120 + (appliedOpIds.current.size - opsToApply.length + index) * 16;

          if (op.type === "drawRectangle") {
            return {
              id: createShapeId(),
              type: "geo",
              x: baseX,
              y: baseY,
              props: { geo: "rectangle", w: 220, h: 100 },
            };
          }

          if (op.type === "drawArrow") {
            return {
              id: createShapeId(),
              type: "arrow",
              x: baseX,
              y: baseY,
              props: {
                start: { x: 0, y: 0 },
                end: { x: 180, y: 80 },
              },
            };
          }

          return {
            id: createShapeId(),
            type: "geo",
            x: baseX,
            y: baseY,
            props: { geo: "rectangle", w: 220, h: 100, color: "blue" },
          };
        });

        // 批量创建形状，减少重渲染
        editor.createShapes(shapes as any);
        setOpsCount(appliedOpIds.current.size);
      }

      isApplying.current = false;

      // 如果还有剩余操作，继续调度
      if (pendingOps.current.length > 0) {
        requestIdleCallback(applyPendingOps);
      }
    });
  }, []);

  useEffect(() => {
    const opsArray = ydoc.getArray<CanvasOp>("ops");

    // 初始化时加载已有操作
    const existingOps = opsArray.toArray();
    pendingOps.current.push(...existingOps);
    applyPendingOps();
    setOpsCount(appliedOpIds.current.size);

    // 监听数组变化
    const observer = (event: Y.YArrayEvent<CanvasOp>) => {
      const addedOps = event.changes.added;
      const newOps: CanvasOp[] = [];

      addedOps.forEach((item) => {
        if (item.content instanceof Y.ContentAny) {
          newOps.push(...(item.content.getContent() as CanvasOp[]));
        }
      });

      if (newOps.length > 0) {
        pendingOps.current.push(...newOps);
        applyPendingOps();
      }
    };

    opsArray.observe(observer);
    provider.on("status", (event: { status?: string }) =>
      setStatus(event.status ?? "unknown"),
    );

    // Web Worker 消息处理，用于离线处理操作
    opWorker.onmessage = (e) => {
      const { processedOps } = e.data;
      pendingOps.current.push(...processedOps);
      applyPendingOps();
    };

    return () => {
      opsArray.unobserve(observer);
      provider.destroy();
      ydoc.destroy();
      opWorker.terminate();
    };
  }, [provider, ydoc, applyPendingOps]);

  return (
    <main className="stage">
      <header className="statusBar">
        <span>Desktop 演示台（Tldraw）</span>
        <span>Hocuspocus: {status}</span>
        <span>Ops: {opsCount}</span>
        {latency !== null && <span>Latency: {latency}ms</span>}
      </header>
      <section className="canvasWrap">
        <Tldraw
          options={{
            edgeScrollSpeed: 1,
          }}
          onMount={(editor) => {
            editorRef.current = editor;
          }}
        />
      </section>
    </main>
  );
}

export default App;
