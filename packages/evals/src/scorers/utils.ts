import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent, ScoringInput } from '@mastra/core/evals';
import { RequestContext } from '@mastra/core/request-context';
import type { ToolInvocation } from 'ai';

// Helper type to extract specific part types from MastraMessageContentV2
type MessagePart = MastraMessageContentV2['parts'][number];
type ToolInvocationPart = Extract<MessagePart, { type: 'tool-invocation' }>;
type TextPart = Extract<MessagePart, { type: 'text' }>;

/**
 * Extract text content from MastraDBMessage
 * Extracts all text parts from the parts array and combines them
 */
export function getTextContentFromMastraDBMessage(message: MastraDBMessage): string {
  if (message.content.parts && Array.isArray(message.content.parts)) {
    // Combine all text parts
    const textParts = message.content.parts.filter(p => p.type === 'text');
    return textParts.map(p => p.text).join('');
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
    args: Record<string, unknown>;
    result: Record<string, unknown>;
    state: 'call' | 'result' | 'partial-call';
  }>;
}): MastraDBMessage {
  const parts: MessagePart[] = [{ type: 'text', text: content } as TextPart];

  // Add tool invocations as tool-invocation parts
  if (toolInvocations.length > 0) {
    for (const ti of toolInvocations) {
      parts.push({
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: ti.toolCallId,
          toolName: ti.toolName,
          args: ti.args,
          result: ti.result,
          state: ti.state,
        },
      } as ToolInvocationPart);
    }
  }

  return {
    id,
    role,
    content: {
      format: 2,
      parts,
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
    // Extract tool calls from parts array
    if (message?.content?.parts && Array.isArray(message.content.parts)) {
      let invocationIndex = 0;
      for (const part of message.content.parts) {
        if (part.type === 'tool-invocation' && part.toolInvocation?.toolName) {
          const toolName = part.toolInvocation.toolName;
          const state = part.toolInvocation.state;
          if (state === 'result' || state === 'call') {
            toolCalls.push(toolName);
            toolCallInfos.push({
              toolName,
              toolCallId: part.toolInvocation.toolCallId || `${messageIndex}-${invocationIndex}`,
              messageIndex,
              invocationIndex,
            });
            invocationIndex++;
          }
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
