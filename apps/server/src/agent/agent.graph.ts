import { Annotation, StateGraph } from '@langchain/langgraph';
import { ParsedIntent } from './agent.types';

const AgentInput = Annotation.Root({
  text: Annotation<string>,
});

const AgentOutput = Annotation.Root({
  intent: Annotation<ParsedIntent>,
});

function parseIntentNode(
  state: typeof AgentInput.State,
): Partial<typeof AgentOutput.State> {
  const text = state.text.toLowerCase();

  if (text.includes('箭头') || text.includes('arrow')) {
    return { intent: { type: 'drawArrow' } };
  }

  if (text.includes('文字') || text.includes('text')) {
    return { intent: { type: 'addText', content: state.text } };
  }

  return { intent: { type: 'drawRectangle', content: state.text } };
}

export const agentGraph = new StateGraph({
  input: AgentInput,
  output: AgentOutput,
})
  .addNode('parseIntent', parseIntentNode)
  .addEdge('__start__', 'parseIntent')
  .compile();
