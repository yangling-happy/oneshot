import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { inflate } from "pako";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type CanvasOp = {
  id: string;
  type: "drawRectangle" | "drawArrow" | "addText";
  payload?: Record<string, unknown>;
  timestamp: number;
};

type Shape = {
  id: string;
  type: "rectangle" | "arrow";
  x: number;
  y: number;
  width?: number;
  height?: number;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  color: string;
};

export default function CanvasScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const [status, setStatus] = useState("connecting");
  const [opsCount, setOpsCount] = useState(0);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const appliedOpIds = useRef(new Set<string>());

  // 画布变换参数
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isPinching = useSharedValue(false);

  const ydoc = useMemo(() => new Y.Doc(), []);
  const provider = useMemo(() => {
    return new HocuspocusProvider({
      url: "ws://172.20.10.2:1234", // 替换为你的实际服务端地址
      name: "oneshot-canvas",
      document: ydoc,
      // 自定义消息处理，支持压缩更新
      onMessage: (data: any) => {
        try {
          const messageType = data.data ? data.data[0] : data[0];

          // 处理压缩的增量更新
          if (messageType === 1) {
            const compressedData = (data.data || data).slice(1);
            const decompressed = inflate(compressedData);
            Y.applyUpdate(ydoc, decompressed);
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

  // 应用操作到画布
  const applyOps = (ops: CanvasOp[]) => {
    const newShapes: Shape[] = [];

    ops.forEach((op, index) => {
      if (appliedOpIds.current.has(op.id)) return;
      appliedOpIds.current.add(op.id);

      const baseX = 50 + (appliedOpIds.current.size - ops.length + index) * 20;
      const baseY = 100 + (appliedOpIds.current.size - ops.length + index) * 15;

      if (op.type === "drawRectangle") {
        newShapes.push({
          id: op.id,
          type: "rectangle",
          x: baseX,
          y: baseY,
          width: 180,
          height: 80,
          color: "#3b82f6",
        });
      } else if (op.type === "drawArrow") {
        newShapes.push({
          id: op.id,
          type: "arrow",
          x: baseX,
          y: baseY,
          start: { x: 0, y: 0 },
          end: { x: 150, y: 60 },
          color: "#ef4444",
        });
      } else {
        newShapes.push({
          id: op.id,
          type: "rectangle",
          x: baseX,
          y: baseY,
          width: 180,
          height: 80,
          color: "#10b981",
        });
      }
    });

    if (newShapes.length > 0) {
      setShapes((prev) => [...prev, ...newShapes]);
      setOpsCount(appliedOpIds.current.size);
    }
  };

  useEffect(() => {
    const opsArray = ydoc.getArray<CanvasOp>("ops");

    // 初始化加载已有操作
    const existingOps = opsArray.toArray();
    applyOps(existingOps);

    // 监听数组变化
    const observer = (event: Y.YArrayEvent<CanvasOp>) => {
      const addedOps = event.changes.added;
      const newOps: CanvasOp[] = [];

      addedOps.forEach((item: any) => {
        if (item.content instanceof Y.ContentAny) {
          newOps.push(...(item.content.getContent() as CanvasOp[]));
        }
      });

      if (newOps.length > 0) {
        applyOps(newOps);
      }
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

  // 平移手势
  const panGesture = Gesture.Pan()
    .enabled(!isPinching.value)
    .onUpdate((event) => {
      translateX.value += event.translationX;
      translateY.value += event.translationY;
    })
    .onEnd(() => {
      // 可选：添加惯性效果
    });

  // 缩放手势
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      isPinching.value = true;
    })
    .onUpdate((event) => {
      scale.value = Math.max(0.5, Math.min(3, scale.value * event.scale));
    })
    .onEnd(() => {
      isPinching.value = false;
    });

  // 双击重置手势
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withTiming(1);
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
    });

  // 组合手势
  const composedGesture = Gesture.Race(
    pinchGesture,
    panGesture,
    doubleTapGesture,
  );

  // 画布动画样式
  const canvasAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  // 重置画布视图
  const resetView = () => {
    scale.value = withTiming(1);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.statusBar}>
        <Text style={[styles.statusText, { color: Colors[colorScheme].text }]}>
          移动端画布
        </Text>
        <Text style={[styles.statusText, { color: Colors[colorScheme].text }]}>
          连接状态: {status}
        </Text>
        <Text style={[styles.statusText, { color: Colors[colorScheme].text }]}>
          元素: {opsCount}
        </Text>
        <Pressable style={styles.resetButton} onPress={resetView}>
          <Text style={styles.resetButtonText}>重置视图</Text>
        </Pressable>
      </View>

      <GestureDetector gesture={composedGesture}>
        <Animated.View style={styles.canvasContainer}>
          <Animated.View style={[styles.canvas, canvasAnimatedStyle]}>
            {shapes.map((shape) => {
              if (shape.type === "rectangle") {
                return (
                  <View
                    key={shape.id}
                    style={[
                      styles.rectangle,
                      {
                        left: shape.x,
                        top: shape.y,
                        width: shape.width,
                        height: shape.height,
                        backgroundColor: shape.color,
                      },
                    ]}
                  />
                );
              } else if (shape.type === "arrow") {
                return (
                  <View
                    key={shape.id}
                    style={[
                      styles.arrow,
                      (() => {
                        const startX = shape.start?.x ?? 0;
                        const startY = shape.start?.y ?? 0;
                        const endX = shape.end?.x ?? 150;
                        const endY = shape.end?.y ?? 60;
                        const dx = endX - startX;
                        const dy = endY - startY;
                        const length = Math.sqrt(dx * dx + dy * dy);
                        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                        return {
                          left: shape.x + startX,
                          top: shape.y + startY,
                          width: length,
                          height: 3,
                          backgroundColor: shape.color,
                          transform: [{ rotate: `${angle}deg` }],
                          transformOrigin: "0 50%",
                        };
                      })(),
                    ]}
                  />
                );
              }
              return null;
            })}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <View style={styles.hintBar}>
        <Text style={[styles.hintText, { color: Colors[colorScheme].text }]}>
          双指缩放/平移 · 双击重置视图
        </Text>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2f2f2f",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "500",
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#3b82f6",
    borderRadius: 6,
  },
  resetButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  canvasContainer: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#fafafa",
  },
  canvas: {
    width: 2000,
    height: 2000,
    position: "relative",
    backgroundColor: "#ffffff",
  },
  rectangle: {
    position: "absolute",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  arrow: {
    position: "absolute",
    borderRadius: 2,
  },
  hintBar: {
    padding: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  hintText: {
    fontSize: 12,
    opacity: 0.6,
  },
});
