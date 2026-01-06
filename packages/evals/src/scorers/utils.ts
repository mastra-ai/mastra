import type { MastraDBMessage } from '@mastra/core/agent';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent, ScoringInput } from '@mastra/core/evals';
import { RequestContext } from '@mastra/core/request-context';

/**
 * Extracts text content from a MastraDBMessage.
 *
 * This function matches the logic used in `MessageList.mastraDBMessageToAIV4UIMessage`.
 * It first checks for a string `content.content` field, then falls back to extracting
 * text from the `parts` array (returning only the last text part, like AI SDK does).
 *
 * @param message - The MastraDBMessage to extract text from
 * @returns The extracted text content, or an empty string if no text is found
 *
 * @example
 * ```ts
 * const message: MastraDBMessage = {
 *   id: 'msg-1',
 *   role: 'assistant',
 *   content: { format: 2, parts: [{ type: 'text', text: 'Hello!' }] },
 *   createdAt: new Date(),
 * };
 * const text = getTextContentFromMastraDBMessage(message); // 'Hello!'
 * ```
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

/**
 * Rounds a number to two decimal places.
 *
 * Uses `Number.EPSILON` to handle floating-point precision issues.
 *
 * @param num - The number to round
 * @returns The number rounded to two decimal places
 *
 * @example
 * ```ts
 * roundToTwoDecimals(0.1 + 0.2); // 0.3
 * roundToTwoDecimals(1.005); // 1.01
 * ```
 */
export const roundToTwoDecimals = (num: number) => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

/**
 * Determines if a value is closer to the first target than the second.
 *
 * @param value - The value to compare
 * @param target1 - The first target value
 * @param target2 - The second target value
 * @returns `true` if `value` is closer to `target1` than `target2`
 *
 * @example
 * ```ts
 * isCloserTo(0.6, 1, 0); // true (0.6 is closer to 1)
 * isCloserTo(0.3, 1, 0); // false (0.3 is closer to 0)
 * ```
 */
export function isCloserTo(value: number, target1: number, target2: number): boolean {
  return Math.abs(value - target1) < Math.abs(value - target2);
}

/**
 * Represents a test case for scorer evaluation.
 */
export type TestCase = {
  /** The input text to evaluate */
  input: string;
  /** The output text to evaluate */
  output: string;
  /** The expected result of the evaluation */
  expectedResult: {
    /** The expected score */
    score: number;
    /** The optional expected reason */
    reason?: string;
  };
};

/**
 * Represents a test case with additional context for scorer evaluation.
 */
export type TestCaseWithContext = TestCase & {
  /** Additional context strings for the evaluation */
  context: string[];
};

/**
 * Creates a scoring input object for testing purposes.
 *
 * @param input - The user input text
 * @param output - The assistant output text
 * @param additionalContext - Optional additional context data
 * @param requestContext - Optional request context data
 * @returns A ScoringInput object ready for use in scorer tests
 *
 * @example
 * ```ts
 * const run = createTestRun(
 *   'What is 2+2?',
 *   'The answer is 4.',
 *   { topic: 'math' }
 * );
 * ```
 */
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

/**
 * Extracts the user message text from a scorer run input.
 *
 * Finds the first message with role 'user' and extracts its text content.
 *
 * @param input - The scorer run input containing input messages
 * @returns The user message text, or `undefined` if no user message is found
 *
 * @example
 * ```ts
 * const scorer = createScorer({ ... })
 *   .preprocess(({ run }) => {
 *     const userText = getUserMessageFromRunInput(run.input);
 *     return { userText };
 *   });
 * ```
 */
export const getUserMessageFromRunInput = (input?: ScorerRunInputForAgent): string | undefined => {
  const message = input?.inputMessages.find(({ role }) => role === 'user');
  return message ? getTextContentFromMastraDBMessage(message) : undefined;
};

/**
 * Extracts all system messages from a scorer run input.
 *
 * Collects text from both standard system messages and tagged system messages
 * (specialized system prompts like memory instructions).
 *
 * @param input - The scorer run input containing system messages
 * @returns An array of system message strings
 *
 * @example
 * ```ts
 * const scorer = createScorer({ ... })
 *   .preprocess(({ run }) => {
 *     const systemMessages = getSystemMessagesFromRunInput(run.input);
 *     return { systemPrompt: systemMessages.join('\n') };
 *   });
 * ```
 */
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
              .filter((part: any) => part.type === 'text')
              .map((part: any) => part.text || '')
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

/**
 * Combines all system messages into a single prompt string.
 *
 * Joins all system messages (standard and tagged) with double newlines.
 *
 * @param input - The scorer run input containing system messages
 * @returns A combined system prompt string
 *
 * @example
 * ```ts
 * const scorer = createScorer({ ... })
 *   .preprocess(({ run }) => {
 *     const systemPrompt = getCombinedSystemPrompt(run.input);
 *     return { systemPrompt };
 *   });
 * ```
 */
export const getCombinedSystemPrompt = (input?: ScorerRunInputForAgent): string => {
  const systemMessages = getSystemMessagesFromRunInput(input);
  return systemMessages.join('\n\n');
};

/**
 * Extracts the assistant message text from a scorer run output.
 *
 * Finds the first message with role 'assistant' and extracts its text content.
 *
 * @param output - The scorer run output (array of MastraDBMessage)
 * @returns The assistant message text, or `undefined` if no assistant message is found
 *
 * @example
 * ```ts
 * const scorer = createScorer({ ... })
 *   .preprocess(({ run }) => {
 *     const response = getAssistantMessageFromRunOutput(run.output);
 *     return { response };
 *   });
 * ```
 */
export const getAssistantMessageFromRunOutput = (output?: ScorerRunOutputForAgent) => {
  const message = output?.find(({ role }) => role === 'assistant');
  return message ? getTextContentFromMastraDBMessage(message) : undefined;
};

/**
 * Extracts reasoning text from a scorer run output.
 *
 * This function extracts reasoning content from assistant messages, which is
 * produced by reasoning models like `deepseek-reasoner`. The reasoning can be
 * stored in two places:
 * 1. `content.reasoning` - a string field on the message content
 * 2. `content.parts` - as parts with `type: 'reasoning'` containing `details`
 *
 * @param output - The scorer run output (array of MastraDBMessage)
 * @returns The reasoning text, or `undefined` if no reasoning is present
 *
 * @example
 * ```ts
 * const reasoningScorer = createScorer({
 *   id: 'reasoning-scorer',
 *   name: 'Reasoning Quality',
 *   description: 'Evaluates the quality of model reasoning',
 *   type: 'agent',
 * })
 *   .preprocess(({ run }) => {
 *     const reasoning = getReasoningFromRunOutput(run.output);
 *     const response = getAssistantMessageFromRunOutput(run.output);
 *     return { reasoning, response };
 *   })
 *   .generateScore(({ results }) => {
 *     // Score based on reasoning quality
 *     return results.preprocessStepResult?.reasoning ? 1 : 0;
 *   });
 * ```
 */
export const getReasoningFromRunOutput = (output?: ScorerRunOutputForAgent): string | undefined => {
  if (!output) return undefined;

  const message = output.find(({ role }) => role === 'assistant');
  if (!message) return undefined;

  // Check for reasoning in content.reasoning (string format)
  if (message.content.reasoning) {
    return message.content.reasoning;
  }

  // Check for reasoning in parts with type 'reasoning'
  // Reasoning models store reasoning in parts as { type: 'reasoning', details: [{ type: 'text', text: '...' }] }
  const reasoningParts = message.content.parts?.filter((p: any) => p.type === 'reasoning');
  if (reasoningParts && reasoningParts.length > 0) {
    const reasoningTexts = reasoningParts
      .map((p: any) => {
        // The reasoning text can be in p.reasoning or in p.details[].text
        if (p.details && Array.isArray(p.details)) {
          return p.details
            .filter((d: any) => d.type === 'text')
            .map((d: any) => d.text)
            .join('');
        }
        return p.reasoning || '';
      })
      .filter(Boolean);

    return reasoningTexts.length > 0 ? reasoningTexts.join('\n') : undefined;
  }

  return undefined;
};

/**
 * Creates a tool invocation object for testing purposes.
 *
 * @param options - The tool invocation configuration
 * @param options.toolCallId - Unique identifier for the tool call
 * @param options.toolName - Name of the tool being called
 * @param options.args - Arguments passed to the tool
 * @param options.result - Result returned by the tool
 * @param options.state - State of the invocation (default: 'result')
 * @returns A tool invocation object
 *
 * @example
 * ```ts
 * const invocation = createToolInvocation({
 *   toolCallId: 'call-123',
 *   toolName: 'weatherTool',
 *   args: { location: 'London' },
 *   result: { temperature: 20, condition: 'sunny' },
 * });
 * ```
 */
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
  state?: 'call' | 'partial-call' | 'result';
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
 * Creates a MastraDBMessage object for testing purposes.
 *
 * Supports optional tool invocations for testing tool call scenarios.
 *
 * @param options - The message configuration
 * @param options.content - The text content of the message
 * @param options.role - The role of the message sender ('user', 'assistant', or 'system')
 * @param options.id - Optional message ID (default: 'test-message')
 * @param options.toolInvocations - Optional array of tool invocations
 * @returns A MastraDBMessage object
 *
 * @example
 * ```ts
 * const message = createTestMessage({
 *   content: 'Hello, how can I help?',
 *   role: 'assistant',
 * });
 *
 * // With tool invocations
 * const messageWithTools = createTestMessage({
 *   content: 'Let me check the weather.',
 *   role: 'assistant',
 *   toolInvocations: [{
 *     toolCallId: 'call-1',
 *     toolName: 'weatherTool',
 *     args: { location: 'Paris' },
 *     result: { temp: 22 },
 *     state: 'result',
 *   }],
 * });
 * ```
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

/**
 * Creates a complete agent test run object for testing scorers.
 *
 * Provides a convenient way to construct the full run object that scorers receive,
 * including input messages, output, system messages, and request context.
 *
 * @param options - The test run configuration
 * @param options.inputMessages - Array of input messages (default: [])
 * @param options.output - The output messages (required)
 * @param options.rememberedMessages - Array of remembered messages from memory (default: [])
 * @param options.systemMessages - Array of system messages (default: [])
 * @param options.taggedSystemMessages - Tagged system messages map (default: {})
 * @param options.requestContext - Request context (default: new RequestContext())
 * @param options.runId - Unique run ID (default: random UUID)
 * @returns A complete test run object
 *
 * @example
 * ```ts
 * const testRun = createAgentTestRun({
 *   inputMessages: [createTestMessage({ content: 'Hello', role: 'user' })],
 *   output: [createTestMessage({ content: 'Hi there!', role: 'assistant' })],
 * });
 *
 * const result = await scorer.run({
 *   input: testRun.input,
 *   output: testRun.output,
 * });
 * ```
 */
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

/**
 * Information about a tool call extracted from scorer output.
 */
export type ToolCallInfo = {
  /** Name of the tool that was called */
  toolName: string;
  /** Unique identifier for the tool call */
  toolCallId: string;
  /** Index of the message containing this tool call */
  messageIndex: number;
  /** Index of the invocation within the message's tool invocations */
  invocationIndex: number;
};

/**
 * Extracts all tool calls from a scorer run output.
 *
 * Iterates through all messages and their tool invocations to collect
 * information about tools that were called (with state 'result' or 'call').
 *
 * @param output - The scorer run output (array of MastraDBMessage)
 * @returns An object containing tool names and detailed tool call info
 *
 * @example
 * ```ts
 * const scorer = createScorer({ ... })
 *   .preprocess(({ run }) => {
 *     const { tools, toolCallInfos } = extractToolCalls(run.output);
 *     return {
 *       toolsUsed: tools,
 *       toolCount: tools.length,
 *     };
 *   });
 * ```
 */
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

/**
 * Extracts text content from all input messages.
 *
 * @param runInput - The scorer run input
 * @returns An array of text strings from each input message
 *
 * @example
 * ```ts
 * const scorer = createScorer({ ... })
 *   .preprocess(({ run }) => {
 *     const messages = extractInputMessages(run.input);
 *     return { allUserMessages: messages.join('\n') };
 *   });
 * ```
 */
export const extractInputMessages = (runInput: ScorerRunInputForAgent | undefined): string[] => {
  return runInput?.inputMessages?.map(msg => getTextContentFromMastraDBMessage(msg)) || [];
};

/**
 * Extracts text content from all assistant response messages.
 *
 * Filters for messages with role 'assistant' and extracts their text content.
 *
 * @param runOutput - The scorer run output (array of MastraDBMessage)
 * @returns An array of text strings from each assistant message
 *
 * @example
 * ```ts
 * const scorer = createScorer({ ... })
 *   .preprocess(({ run }) => {
 *     const responses = extractAgentResponseMessages(run.output);
 *     return { allResponses: responses.join('\n') };
 *   });
 * ```
 */
export const extractAgentResponseMessages = (runOutput: ScorerRunOutputForAgent): string[] => {
  return runOutput.filter(msg => msg.role === 'assistant').map(msg => getTextContentFromMastraDBMessage(msg));
};
