import type { MastraDBMessage } from '@mastra/core/agent';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent, ScoringInput } from '@mastra/core/evals';
import { RequestContext } from '@mastra/core/request-context';
import type { ToolInvocation } from 'ai';

/**
 * Extract text content from MastraDBMessage
 * Matches the logic used in MessageList.mastraDBMessageToAIV4UIMessage
 */
export function getTextContentFromMastraDBMessage(message: MastraDBMessage): string {
  if (typeof message.content.content === 'string' && message.content.content !== '') {
    return message.content.content;
  }
  if (message.content.parts && Array.isArray(message.content.parts)) {
    // Return only the last text part like AI SDK does
    const textParts = message.content.parts.filter(p => p.type === 'text');
    return textParts.length > 0 ? textParts[textParts.length - 1]?.text || '' : '';
  }
  return '';
}

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

export const createTestRun = (
  input: string,
  output: string,
  additionalContext?: Record<string, any>,
  requestContext?: Record<string, any>,
): ScoringInput => {
  return {
    input: [{ role: 'user', content: input }],
    output: { role: 'assistant', text: output },
    additionalContext: additionalContext ?? {},
    requestContext: requestContext ?? {},
  };
};

export const getUserMessageFromRunInput = (input?: ScorerRunInputForAgent): string | undefined => {
  const message = input?.inputMessages.find(({ role }) => role === 'user');
  return message ? getTextContentFromMastraDBMessage(message) : undefined;
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
  const message = output?.find(({ role }) => role === 'assistant');
  return message ? getTextContentFromMastraDBMessage(message) : undefined;
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

/**
 * Helper function to create MastraDBMessage objects for tests
 * Supports optional tool invocations for testing tool call scenarios
 */
export function createTestMessage({
  content,
  role,
  id = 'test-message',
  toolInvocations = [],
}: {
  content: string;
  role: 'user' | 'assistant' | 'system';
  id?: string;
  toolInvocations?: Array<{
    toolCallId: string;
    toolName: string;
    args: Record<string, any>;
    result: Record<string, any>;
    state: any;
  }>;
}): MastraDBMessage {
  return {
    id,
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text: content }],
      content,
      ...(toolInvocations.length > 0 && {
        toolInvocations: toolInvocations.map(ti => ({
          toolCallId: ti.toolCallId,
          toolName: ti.toolName,
          args: ti.args,
          result: ti.result,
          state: ti.state,
        })),
      }),
    },
    createdAt: new Date(),
  };
}

export const createAgentTestRun = ({
  inputMessages = [],
  output,
  rememberedMessages = [],
  systemMessages = [],
  taggedSystemMessages = {},
  requestContext = new RequestContext(),
  runId = crypto.randomUUID(),
}: {
  inputMessages?: ScorerRunInputForAgent['inputMessages'];
  output: ScorerRunOutputForAgent;
  rememberedMessages?: ScorerRunInputForAgent['rememberedMessages'];
  systemMessages?: ScorerRunInputForAgent['systemMessages'];
  taggedSystemMessages?: ScorerRunInputForAgent['taggedSystemMessages'];
  requestContext?: RequestContext;
  runId?: string;
}): {
  input: ScorerRunInputForAgent;
  output: ScorerRunOutputForAgent;
  requestContext: RequestContext;
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
    requestContext,
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
    // Tool invocations are now nested under content
    if (message?.content?.toolInvocations) {
      for (let invocationIndex = 0; invocationIndex < message.content.toolInvocations.length; invocationIndex++) {
        const invocation = message.content.toolInvocations[invocationIndex];
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
  return runInput?.inputMessages?.map(msg => getTextContentFromMastraDBMessage(msg)) || [];
};

export const extractAgentResponseMessages = (runOutput: ScorerRunOutputForAgent): string[] => {
  return runOutput.filter(msg => msg.role === 'assistant').map(msg => getTextContentFromMastraDBMessage(msg));
};
