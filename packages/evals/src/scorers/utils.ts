import { RuntimeContext } from '@mastra/core/runtime-context';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent, ScoringInput } from '@mastra/core/scores';
import type { UIMessage } from 'ai';

// Define ToolInvocation type locally since it's from AI SDK v4
type ToolInvocation = {
  state: 'call' | 'result';
  toolCallId: string;
  toolName: string;
  args?: any;
  result?: any;
};

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
  const message = input?.inputMessages.find(({ role }) => role === 'user');
  if (!message) return undefined;
  // Handle both string content and part array content
  if (typeof (message as any).content === 'string') {
    return (message as any).content;
  }
  // If content is an array of parts, extract text parts
  if (Array.isArray((message as any).content)) {
    return (message as any).content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('');
  }
  return undefined;
};

export const getAssistantMessageFromRunOutput = (output?: ScorerRunOutputForAgent) => {
  const message = output?.find(({ role }) => role === 'assistant');
  if (!message) return undefined;
  // Handle both string content and part array content
  if (typeof (message as any).content === 'string') {
    return (message as any).content;
  }
  // If content is an array of parts, extract text parts
  if (Array.isArray((message as any).content)) {
    return (message as any).content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('');
  }
  return undefined;
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
  state?: ToolInvocation['state'];
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
}: {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolInvocations?: Array<{
    toolCallId: string;
    toolName: string;
    args: Record<string, any>;
    result: Record<string, any>;
    state: any;
  }>;
}): UIMessage => {
  return {
    id,
    role,
    content: [{ type: 'text', text: content }],
    parts: [{ type: 'text', text: content }],
  } as UIMessage;
};

export const createAgentTestRun = ({
  inputMessages = [],
  output,
  rememberedMessages = [],
  systemMessages = [],
  taggedSystemMessages = {},
  runtimeContext = new RuntimeContext(),
  runId = crypto.randomUUID(),
}: {
  inputMessages?: ScorerRunInputForAgent['inputMessages'];
  output: ScorerRunOutputForAgent;
  rememberedMessages?: ScorerRunInputForAgent['rememberedMessages'];
  systemMessages?: ScorerRunInputForAgent['systemMessages'];
  taggedSystemMessages?: ScorerRunInputForAgent['taggedSystemMessages'];
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
      taggedSystemMessages,
    },
    output,
    runtimeContext,
    runId,
  };
};
