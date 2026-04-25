import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { ThemedText } from "@/components/themed-text";

export default function HomeScreen() {
  const [apiBase, setApiBase] = useState("http://172.20.10.2:3000");
  const [text, setText] = useState("画一个标题为 Oneshot 的矩形");
  const [result, setResult] = useState("未发送");
  const [loading, setLoading] = useState(false);

  const onSend = async () => {
    if (!text.trim()) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/agent/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      setResult(`${data.status ?? "unknown"} | op=${data.op?.type ?? "-"}`);
    } catch (error) {
      setResult(`error: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ThemedText type="title">移动端 IM 模拟</ThemedText>
      <ThemedText style={styles.tip}>后端地址</ThemedText>
      <TextInput
        value={apiBase}
        onChangeText={setApiBase}
        autoCapitalize="none"
        style={styles.input}
      />

      <ThemedText style={styles.tip}>文本指令</ThemedText>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        style={[styles.input, styles.command]}
      />

      <Pressable style={styles.button} onPress={onSend} disabled={loading}>
        <ThemedText style={styles.buttonText}>
          {loading ? "发送中..." : "发送到 Agent"}
        </ThemedText>
      </Pressable>

      <ThemedText style={styles.result}>最近结果：{result}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 10 },
  tip: { opacity: 0.8 },
  input: {
    borderWidth: 1,
    borderColor: "#6b7280",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#e5e7eb",
  },
  command: { minHeight: 120, textAlignVertical: "top" },
  button: {
    marginTop: 8,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  buttonText: { color: "#fff" },
  result: { marginTop: 6 },
});
