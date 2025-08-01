import { RuntimeContext } from '@mastra/core/runtime-context';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent, ScoringInput } from '@mastra/core/scores';

export const roundToTwoDecimals = (num: number) => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export function isCloserTo(value: number, target1: number, target2: number): boolean {
  return Math.abs(value - target1) < Math.abs(value - target2);
}

export type TestCase = {
  input: string;
  output: string;
  expectedResult: {
    score: number;
    reason?: string;
  };
};

export type TestCaseWithContext = TestCase & {
  context: string[];
};

export const createTestRun = (input: string, output: string, context?: string[]): ScoringInput => {
  return {
    input: [{ role: 'user', content: input }],
    output: { role: 'assistant', text: output },
    additionalContext: { context },
    runtimeContext: {},
  };
};

export const getUserMessageFromRunInput = (input?: ScorerRunInputForAgent) => {
  return input?.inputMessages.find(({ role }) => role === 'user')?.content;
};

export const getAssistantMessageFromRunOutput = (output?: ScorerRunOutputForAgent) => {
  return output?.find(({ role }) => role === 'assistant')?.content;
};

export const createToolInvocation = ({
  toolCallId,
  toolName,
  args,
  result,
  state = 'result',
}: {
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  result: Record<string, any>;
  state?: 'result' | 'error';
}): { toolCallId: string; toolName: string; args: Record<string, any>; result: Record<string, any>; state: string } => {
  return {
    toolCallId,
    toolName,
    args,
    result,
    state,
  };
};

export const createUIMessage = ({
  content,
  role,
  id = 'test-message',
  type = 'text',
  toolInvocations = [],
}: {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type?: string;
  toolInvocations?: Array<{
    toolCallId: string;
    toolName: string;
    args: Record<string, any>;
    result: Record<string, any>;
    state: string;
  }>;
}): {
  id: string;
  role: string;
  content: string;
  parts: Array<{ type: string; text: string }>;
  toolInvocations: Array<{
    toolCallId: string;
    toolName: string;
    args: Record<string, any>;
    result: Record<string, any>;
    state: string;
  }>;
} => {
  return {
    id,
    role,
    content,
    parts: [{ type, text: content }],
    toolInvocations,
  };
};

export const createAgentTestRun = ({
  inputMessages,
  output,
  rememberedMessages = [],
  systemMessages = [],
  runtimeContext = new RuntimeContext(),
  runId = crypto.randomUUID(),
}: {
  inputMessages: ScorerRunInputForAgent['inputMessages'];
  output: ScorerRunOutputForAgent;
  rememberedMessages?: ScorerRunInputForAgent['rememberedMessages'];
  systemMessages?: ScorerRunInputForAgent['systemMessages'];
  runtimeContext?: RuntimeContext;
  runId?: string;
}): {
  input: ScorerRunInputForAgent;
  output: ScorerRunOutputForAgent;
  runtimeContext: RuntimeContext;
  runId: string;
} => {
  return {
    input: {
      inputMessages,
      rememberedMessages,
      systemMessages,
      taggedSystemMessages: {},
    },
    output,
    runtimeContext,
    runId,
  };
};
