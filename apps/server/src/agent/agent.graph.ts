import { Annotation, StateGraph } from '@langchain/langgraph';
import { ParsedIntent } from './agent.types';

const AgentInput = Annotation.Root({
  text: Annotation<string>,
});

const AgentOutput = Annotation.Root({
  intent: Annotation<ParsedIntent>,
});

const ARK_BASE_URL =
  process.env.ARK_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3';
const ARK_ENDPOINT_ID = process.env.ARK_ENDPOINT_ID;
const ARK_API_KEY = process.env.ARK_API_KEY;

function fallbackIntent(text: string): ParsedIntent {
  const lower = text.toLowerCase();

  if (lower.includes('箭头') || lower.includes('arrow')) {
    return { type: 'drawArrow' };
  }

  if (lower.includes('文字') || lower.includes('text')) {
    return { type: 'addText', content: text };
  }

  return { type: 'drawRectangle', content: text };
}

function isValidIntent(intent: unknown): intent is ParsedIntent {
  if (!intent || typeof intent !== 'object') {
    return false;
  }

  const candidate = intent as { type?: unknown; content?: unknown };
  const validType =
    candidate.type === 'drawRectangle' ||
    candidate.type === 'drawArrow' ||
    candidate.type === 'addText';

  const validContent =
    candidate.content === undefined || typeof candidate.content === 'string';

  return validType && validContent;
}

async function parseIntentWithArk(text: string): Promise<ParsedIntent | null> {
  if (!ARK_API_KEY || !ARK_ENDPOINT_ID) {
    return null;
  }

  const response = await fetch(`${ARK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ARK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ARK_ENDPOINT_ID,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            '你是画布指令解析器。请严格输出 JSON，格式为 {"type":"drawRectangle|drawArrow|addText","content":"可选文本"}。',
        },
        {
          role: 'user',
          content: `用户指令：${text}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    return isValidIntent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function parseIntentNode(
  state: typeof AgentInput.State,
): Promise<Partial<typeof AgentOutput.State>> {
  const llmIntent = await parseIntentWithArk(state.text);
  if (llmIntent) {
    return { intent: llmIntent };
  }

  return { intent: fallbackIntent(state.text) };
}

export const agentGraph = new StateGraph({
  input: AgentInput,
  output: AgentOutput,
})
  .addNode('parseIntent', parseIntentNode)
  .addEdge('__start__', 'parseIntent')
  .compile();
