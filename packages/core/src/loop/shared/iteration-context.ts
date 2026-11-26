import type { IterationCompleteContext } from '../../agent/agent.types';
import type { MastraDBMessage } from '../../memory';

interface ToolCallLike {
  toolCallId?: string;
  id?: string;
  toolName?: string;
  name?: string;
  args?: unknown;
}

type IterationContextInput = Omit<IterationCompleteContext, 'toolCalls' | 'agentName'> & {
  agentName?: string;
  toolCalls: ToolCallLike[];
};

export function createIterationCompleteContext(input: IterationContextInput): IterationCompleteContext {
  const { toolCalls, agentName, ...rest } = input;
  return {
    ...rest,
    agentName: agentName || input.agentId,
    toolCalls: toolCalls.map(tc => ({
      id: tc.toolCallId || tc.id || '',
      name: tc.toolName || tc.name || '',
      args: (tc.args || {}) as Record<string, unknown>,
    })),
  };
}

export function createIterationFeedbackMessage(id: string, feedback: string): MastraDBMessage {
  return {
    id,
    createdAt: new Date(),
    type: 'text',
    role: 'assistant',
    content: {
      parts: [{ type: 'text', text: feedback }],
      metadata: {
        mode: 'stream',
        completionResult: { suppressFeedback: true },
      },
      format: 2,
    },
  };
}
