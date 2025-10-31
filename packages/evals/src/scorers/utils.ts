import { RequestContext } from '@mastra/core/request-context';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent, ScoringInput } from '@mastra/core/scores';
import type { MastraMessageV2 } from '@mastra/core/agent';
import type { ToolInvocation, UIMessage } from 'ai';

/**
 * Extract text content from MastraMessageV2
 * Checks content.content first, then falls back to extracting from parts
 */
export function getMessageContent(message: MastraMessageV2): string {
  if (typeof message.content.content === 'string') {
    return message.content.content;
  }
  // Extract from parts - AI SDK convention: last text part only
  const textParts =
    message.content.parts?.filter((part: any) => part.type === 'text').map((part: any) => part.text) || [];
  return textParts[textParts.length - 1] || '';
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

export const getUserMessageFromRunInput = (input?: ScorerRunInputForAgent) => {
  const userMessage = input?.inputMessages.find(({ role }) => role === 'user');
  return userMessage ? getMessageContent(userMessage) : undefined;
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
  const assistantMessage = output?.find(({ role }) => role === 'assistant');
  return assistantMessage ? getMessageContent(assistantMessage) : undefined;
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
}): ToolInvocation => {
  return {
    toolCallId,
    toolName,
    args,
    result,
    state,
  } as ToolInvocation;
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

/**
 * Create a MastraMessageV2 for testing purposes
 * This is the format used internally and stored in the database
 */
export const createMastraMessageV2 = ({
  content,
  role,
  id = `test-msg-${crypto.randomUUID()}`,
  toolInvocations = [],
  threadId,
  resourceId,
  createdAt = new Date(),
  metadata,
}: {
  content: string;
  role: 'user' | 'assistant' | 'system';
  id?: string;
  toolInvocations?: Array<{
    toolCallId: string;
    toolName: string;
    args: Record<string, any>;
    result?: Record<string, any>;
    state?: ToolInvocation['state'];
  }>;
  threadId?: string;
  resourceId?: string;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
}): MastraMessageV2 => {
  const parts: Array<{ type: 'text'; text: string } | { type: 'tool-invocation'; toolInvocation: ToolInvocation }> = [];

  // Add tool invocation parts
  for (const toolInvocation of toolInvocations) {
    parts.push({
      type: 'tool-invocation',
      toolInvocation: {
        state: toolInvocation.state || 'result',
        toolCallId: toolInvocation.toolCallId,
        toolName: toolInvocation.toolName,
        args: toolInvocation.args,
        ...(toolInvocation.result && { result: toolInvocation.result }),
      } as ToolInvocation,
    });
  }

  // Add text part if content exists
  if (content.trim()) {
    parts.push({
      type: 'text',
      text: content,
    });
  }

  return {
    id,
    role,
    createdAt,
    threadId,
    resourceId,
    content: {
      format: 2,
      parts,
      content,
      ...(toolInvocations.length > 0 && {
        toolInvocations: toolInvocations.map(ti => ({
          state: ti.state || 'result',
          toolCallId: ti.toolCallId,
          toolName: ti.toolName,
          args: ti.args,
          ...(ti.result && { result: ti.result }),
        })) as ToolInvocation[],
      }),
      ...(metadata && { metadata }),
    },
  };
};

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
    // Access toolInvocations through content wrapper for MastraMessageV2
    const toolInvocations = message?.content.toolInvocations;
    if (toolInvocations) {
      for (let invocationIndex = 0; invocationIndex < toolInvocations.length; invocationIndex++) {
        const invocation = toolInvocations[invocationIndex];
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
  return runInput?.inputMessages?.map(msg => getMessageContent(msg)) || [];
};

export const extractAgentResponseMessages = (runOutput: ScorerRunOutputForAgent): string[] => {
  return runOutput.filter(msg => msg.role === 'assistant').map(msg => getMessageContent(msg));
};
