import { RuntimeContext } from '@mastra/core/runtime-context';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent, ScoringInput } from '@mastra/core/scores';
import type { ToolInvocation, UIMessage } from 'ai';

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

export const getSystemMessagesFromRunInput = (input?: ScorerRunInputForAgent): string[] => {
  const systemMessages: string[] = [];

  // Add standard system messages
  if (input?.systemMessages) {
    systemMessages.push(
      ...input.systemMessages
        .map(msg => {
          // Handle different content types - extract text if it's an array of parts
          if (typeof msg.content === 'string') {
            return msg.content;
          } else if (Array.isArray(msg.content)) {
            // Extract text from parts array
            return msg.content
              .filter(part => part.type === 'text')
              .map(part => part.text || '')
              .join(' ');
          }
          return '';
        })
        .filter(content => content),
    );
  }

  // Add tagged system messages (these are specialized system prompts)
  if (input?.taggedSystemMessages) {
    Object.values(input.taggedSystemMessages).forEach(messages => {
      messages.forEach(msg => {
        if (typeof msg.content === 'string') {
          systemMessages.push(msg.content);
        }
      });
    });
  }

  return systemMessages;
};

export const getCombinedSystemPrompt = (input?: ScorerRunInputForAgent): string => {
  const systemMessages = getSystemMessagesFromRunInput(input);
  return systemMessages.join('\n\n');
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
  toolInvocations = [],
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
    content,
    parts: [{ type: 'text', text: content }],
    toolInvocations,
  };
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

export type ToolCallInfo = {
  toolName: string;
  toolCallId: string;
  messageIndex: number;
  invocationIndex: number;
};

export function extractToolCalls(output: ScorerRunOutputForAgent): { tools: string[]; toolCallInfos: ToolCallInfo[] } {
  const toolCalls: string[] = [];
  const toolCallInfos: ToolCallInfo[] = [];

  for (let messageIndex = 0; messageIndex < output.length; messageIndex++) {
    const message = output[messageIndex];
    if (message?.toolInvocations) {
      for (let invocationIndex = 0; invocationIndex < message.toolInvocations.length; invocationIndex++) {
        const invocation = message.toolInvocations[invocationIndex];
        if (invocation && invocation.toolName && (invocation.state === 'result' || invocation.state === 'call')) {
          toolCalls.push(invocation.toolName);
          toolCallInfos.push({
            toolName: invocation.toolName,
            toolCallId: invocation.toolCallId || `${messageIndex}-${invocationIndex}`,
            messageIndex,
            invocationIndex,
          });
        }
      }
    }
  }

  return { tools: toolCalls, toolCallInfos };
}

export const extractInputMessages = (runInput: ScorerRunInputForAgent | undefined): string[] => {
  return runInput?.inputMessages?.map(msg => msg.content) || [];
};

export const extractAgentResponseMessages = (runOutput: ScorerRunOutputForAgent): string[] => {
  return runOutput.filter(msg => msg.role === 'assistant').map(msg => msg.content);
};
