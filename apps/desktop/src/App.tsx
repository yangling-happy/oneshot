import { useEffect, useMemo, useRef, useState } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { Tldraw, createShapeId } from "@tldraw/tldraw";
import * as Y from "yjs";
import "@tldraw/tldraw/tldraw.css";
import "./App.css";

type CanvasOp = {
  id: string;
  type: "drawRectangle" | "drawArrow" | "addText";
  payload?: Record<string, unknown>;
  timestamp: number;
};

function App() {
  const [status, setStatus] = useState("connecting");
  const [opsCount, setOpsCount] = useState(0);
  const editorRef = useRef<any>(null);
  const appliedOpIds = useRef(new Set<string>());

  const ydoc = useMemo(() => new Y.Doc(), []);
  const provider = useMemo(() => {
    return new HocuspocusProvider({
      url: "ws://localhost:1234",
      name: "oneshot-canvas",
      document: ydoc,
    });
  }, [ydoc]);

  useEffect(() => {
    const opsArray = ydoc.getArray<CanvasOp>("ops");

    const applyOp = (op: CanvasOp) => {
      if (appliedOpIds.current.has(op.id)) {
        return;
      }
      appliedOpIds.current.add(op.id);

      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      const text = String(op.payload?.text ?? "");
      const baseX = 200 + appliedOpIds.current.size * 24;
      const baseY = 120 + appliedOpIds.current.size * 16;

      if (op.type === "drawRectangle") {
        editor.createShapes([
          {
            id: createShapeId(),
            type: "geo",
            x: baseX,
            y: baseY,
            props: { geo: "rectangle", w: 220, h: 100 },
          },
        ] as any);
        return;
      }

      if (op.type === "drawArrow") {
        editor.createShapes([
          {
            id: createShapeId(),
            type: "arrow",
            x: baseX,
            y: baseY,
            props: {
              start: { x: 0, y: 0 },
              end: { x: 180, y: 80 },
            },
          },
        ] as any);
        return;
      }

      // 暂时禁用文本形状，先保证基础功能正常
      editor.createShapes([
        {
          id: createShapeId(),
          type: "geo",
          x: baseX,
          y: baseY,
          props: { geo: "rectangle", w: 220, h: 100, color: "blue" },
        },
      ] as any);
    };

    opsArray.toArray().forEach(applyOp);
    setOpsCount(opsArray.length);

    const observer = () => {
      opsArray.toArray().forEach(applyOp);
      setOpsCount(opsArray.length);
    };

    opsArray.observe(observer);
    provider.on("status", (event: { status?: string }) =>
      setStatus(event.status ?? "unknown"),
    );

    return () => {
      opsArray.unobserve(observer);
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  return (
    <main className="stage">
      <header className="statusBar">
        <span>Desktop 演示台（Tldraw）</span>
        <span>Hocuspocus: {status}</span>
        <span>Ops: {opsCount}</span>
      </header>
      <section className="canvasWrap">
        <Tldraw
          onMount={(editor) => {
            editorRef.current = editor;
          }}
        />
      </section>
    </main>
  );
}

export default App;
