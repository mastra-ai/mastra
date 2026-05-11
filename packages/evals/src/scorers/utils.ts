import type { MastraDBMessage } from '@mastra/core/agent';
import type {
  ExpectedStep,
  ScorerRunInputForAgent,
  ScorerRunOutputForAgent,
  ScoringInput,
  TrajectoryExpectation,
  TrajectoryStep,
  Trajectory,
} from '@mastra/core/evals';
import { RequestContext } from '@mastra/core/request-context';

export type ScorerRunInputForLLMJudge =
  | ScorerRunInputForAgent
  | string
  | {
      inputMessages?: unknown[];
      messages?: unknown[];
      prompt?: string;
      text?: string;
      content?: unknown;
      input?: unknown;
      user?: unknown;
      [key: string]: unknown;
    };

export type ScorerRunOutputForLLMJudge =
  | ScorerRunOutputForAgent
  | string
  | unknown[]
  | {
      text?: string;
      content?: unknown;
      role?: string;
      [key: string]: unknown;
    };

/**
 * Extracts text content from a MastraDBMessage or ModelMessage-like object.
 *
 * @param message - The message to extract text from
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
  const content = message.content as any;

  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    const textParts = content.filter(p => p.type === 'text');
    return textParts.length > 0 ? textParts[textParts.length - 1]?.text || '' : '';
  }
  if (typeof content?.content === 'string' && content.content !== '') {
    return content.content;
  }
  if (typeof content?.text === 'string' && content.text !== '') {
    return content.text;
  }
  if (content?.parts && Array.isArray(content.parts)) {
    // Return only the last text part like AI SDK does
    const textParts = content.parts.filter((p: any) => p.type === 'text');
    return textParts.length > 0 ? textParts[textParts.length - 1]?.text || '' : '';
  }
  return '';
}

const isRecord = (value: unknown): value is Record<string, any> => {
  return typeof value === 'object' && value !== null;
};

const getTextFromValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const textParts = value
      .filter(part => isRecord(part) && part.type === 'text' && typeof part.text === 'string')
      .map(part => part.text);
    return textParts.length > 0 ? textParts[textParts.length - 1] : undefined;
  }
  if (!isRecord(value)) return undefined;

  return (
    getTextFromValue(value.content) ??
    (typeof value.text === 'string' ? value.text : undefined) ??
    (typeof value.body === 'string' ? value.body : undefined)
  );
};

export const isScorerRunInputForAgent = (input: unknown): input is ScorerRunInputForAgent => {
  return (
    isRecord(input) &&
    Array.isArray(input.inputMessages) &&
    Array.isArray(input.rememberedMessages) &&
    Array.isArray(input.systemMessages) &&
    isRecord(input.taggedSystemMessages)
  );
};

const isMastraDBMessageLike = (message: unknown): message is MastraDBMessage => {
  return (
    isRecord(message) &&
    typeof message.id === 'string' &&
    typeof message.role === 'string' &&
    'content' in message &&
    'createdAt' in message
  );
};

export const isScorerRunOutputForAgent = (output: unknown): output is ScorerRunOutputForAgent => {
  return Array.isArray(output) && output.every(isMastraDBMessageLike);
};

const getTextFromMessages = (messages: unknown, role: string): string | undefined => {
  if (!Array.isArray(messages)) return undefined;

  const message = messages.find(message => isRecord(message) && message.role === role);
  return message ? getTextFromValue(message) : undefined;
};

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
 * Accepts the agent shape (`{ inputMessages }`), `ModelMessage[]`
 * (`{ messages }`), workflow input (`{ prompt }`), and a bare string.
 *
 * @param input - The scorer run input
 * @returns The user message text, or `undefined` if none can be extracted
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
export const getUserMessageFromRunInput = (input?: unknown): string | undefined => {
  if (typeof input === 'string') return input;
  if (!isRecord(input)) return undefined;

  return (
    getTextFromMessages(input.inputMessages, 'user') ??
    getTextFromMessages(input.messages, 'user') ??
    (typeof input.prompt === 'string' ? input.prompt : undefined) ??
    (typeof input.text === 'string' ? input.text : undefined) ??
    getTextFromValue(input.content) ??
    getTextFromValue(input.input) ??
    getTextFromValue(input.user)
  );
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
export const getSystemMessagesFromRunInput = (input?: unknown): string[] => {
  const systemMessages: string[] = [];
  if (!isRecord(input)) return systemMessages;

  // Add standard system messages
  if (Array.isArray(input.systemMessages)) {
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

  const addSystemMessages = (messages: unknown) => {
    if (!Array.isArray(messages)) return;

    systemMessages.push(
      ...messages
        .filter(message => isRecord(message) && message.role === 'system')
        .map(message => getTextFromValue(message))
        .filter((content): content is string => Boolean(content)),
    );
  };

  addSystemMessages(input.inputMessages);
  addSystemMessages(input.messages);

  // Add tagged system messages (these are specialized system prompts)
  if (isRecord(input.taggedSystemMessages)) {
    Object.values(input.taggedSystemMessages).forEach(messages => {
      if (!Array.isArray(messages)) return;
      messages.forEach(msg => {
        const content = getTextFromValue(msg);
        if (content) {
          systemMessages.push(content);
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
export const getCombinedSystemPrompt = (input?: unknown): string => {
  const systemMessages = getSystemMessagesFromRunInput(input);
  return systemMessages.join('\n\n');
};

/**
 * Extracts the assistant message text from a scorer run output.
 *
 * Accepts the agent shape (`MastraDBMessage[]` / `ModelMessage[]`), workflow
 * output (`{ text }`), task output (`{ content }`), a single assistant message
 * object, and a bare string.
 *
 * @param output - The scorer run output
 * @returns The assistant message text, or `undefined` if none can be extracted
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
export const getAssistantMessageFromRunOutput = (output?: unknown) => {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return getTextFromMessages(output, 'assistant');
  if (!isRecord(output)) return undefined;

  const isAssistantOutput = output.role === undefined || output.role === 'assistant';

  if (isAssistantOutput && typeof output.text === 'string') return output.text;
  if (isAssistantOutput && typeof output.content === 'string') return output.content;
  if (isAssistantOutput && (isRecord(output.content) || Array.isArray(output.content))) {
    return (
      getTextContentFromMastraDBMessage(output as MastraDBMessage) ||
      getTextContentFromMastraDBMessage(output.content as MastraDBMessage) ||
      undefined
    );
  }
  if (output.role === 'assistant') return getTextContentFromMastraDBMessage(output as MastraDBMessage) || undefined;

  return undefined;
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
 * Creates a test run for trajectory scorers where `output` is a `Trajectory`
 * (pre-extracted by the `runEvals` pipeline).
 *
 * @example
 * ```ts
 * const testRun = createTrajectoryTestRun({
 *   inputMessages: [createTestMessage({ content: 'Do X', role: 'user', id: 'u1' })],
 *   trajectory: {
 *     steps: [
 *       { stepType: 'tool_call', name: 'search', toolArgs: { q: 'test' } },
 *     ],
 *   },
 * });
 * ```
 */
export const createTrajectoryTestRun = ({
  inputMessages = [],
  trajectory,
  rememberedMessages = [],
  systemMessages = [],
  taggedSystemMessages = {},
  requestContext = new RequestContext(),
  runId = crypto.randomUUID(),
  expectedTrajectory,
}: {
  inputMessages?: ScorerRunInputForAgent['inputMessages'];
  trajectory: Trajectory;
  rememberedMessages?: ScorerRunInputForAgent['rememberedMessages'];
  systemMessages?: ScorerRunInputForAgent['systemMessages'];
  taggedSystemMessages?: ScorerRunInputForAgent['taggedSystemMessages'];
  requestContext?: RequestContext;
  runId?: string;
  expectedTrajectory?: TrajectoryExpectation;
}): {
  input: ScorerRunInputForAgent;
  output: Trajectory;
  requestContext: RequestContext;
  runId: string;
  expectedTrajectory?: TrajectoryExpectation;
} => {
  return {
    input: {
      inputMessages,
      rememberedMessages,
      systemMessages,
      taggedSystemMessages,
    },
    output: trajectory,
    expectedTrajectory,
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

/**
 * Information about a tool result extracted from scorer output.
 */
export type ToolResultInfo = {
  /** Name of the tool that was called */
  toolName: string;
  /** Unique identifier for the tool call */
  toolCallId: string;
  /** Arguments passed to the tool */
  args: Record<string, any>;
  /** Result returned by the tool */
  result: any;
};

/**
 * Extracts tool results from a scorer run output.
 *
 * Returns structured objects that can be used with the hallucination scorer's
 * `getContext` hook or for other scorer logic.
 *
 * @param output - The scorer run output (array of MastraDBMessage)
 * @returns An array of ToolResultInfo objects
 *
 * @example
 * ```ts
 * import { extractToolResults } from '@mastra/evals/scorers';
 * import { createHallucinationScorer } from '@mastra/evals/scorers/prebuilt';
 *
 * const scorer = createHallucinationScorer({
 *   model: openai('gpt-4o'),
 *   options: {
 *     getContext: (run) => {
 *       const toolResults = extractToolResults(run.output);
 *       return toolResults.map(t => JSON.stringify({ tool: t.toolName, result: t.result }));
 *     },
 *   },
 * });
 * ```
 */
export function extractToolResults(output: ScorerRunOutputForAgent): ToolResultInfo[] {
  const results: ToolResultInfo[] = [];

  for (const message of output) {
    const toolInvocations = message?.content?.toolInvocations;
    if (!toolInvocations) continue;

    for (const invocation of toolInvocations) {
      if (invocation.state === 'result' && invocation.result !== undefined) {
        results.push({
          toolName: invocation.toolName,
          toolCallId: invocation.toolCallId || '',
          args: invocation.args || {},
          result: invocation.result,
        });
      }
    }
  }

  return results;
}

// Re-export extractTrajectory from core — it's called automatically by runEvals
// for trajectory scorers, but users may still want it for custom use cases.
export { extractTrajectory } from '@mastra/core/evals';

/**
 * Compares two trajectories and returns detailed comparison results.
 *
 * This is the core comparison logic used by trajectory scorers. It supports
 * strict and non-strict ordering, optional step data comparison, and loop detection.
 *
 * @param actual - The trajectory the agent actually took
 * @param expected - The expected trajectory to compare against
 * @param options - Comparison configuration options
 * @returns Detailed comparison results including match scores and diagnostics
 *
 * @example
 * ```ts
 * const result = compareTrajectories(
 *   { steps: [{ stepType: 'tool_call', name: 'search' }, { stepType: 'tool_call', name: 'summarize' }] },
 *   { steps: [{ stepType: 'tool_call', name: 'search' }, { stepType: 'tool_call', name: 'summarize' }] },
 *   { ordering: 'strict' }
 * );
 * // result.score = 1.0
 * ```
 */
export function compareTrajectories(
  actual: Trajectory,
  expected: Trajectory | { steps: ExpectedStep[] },
  options: {
    ordering?: 'strict' | 'relaxed' | 'unordered';
    allowRepeatedSteps?: boolean;
  } = {},
): TrajectoryComparisonResult {
  const { allowRepeatedSteps = true, ordering = 'relaxed' } = options;

  // Normalize expected to ExpectedStep[]. TrajectoryStep and ExpectedStep share
  // the same field names, so TrajectoryStep[] can be used directly as ExpectedStep[].
  // The only structural difference is `children` (TrajectoryStep[] vs TrajectoryExpectation),
  // but compareTrajectories doesn't recurse into children.
  const normalizedExpected: { steps: ExpectedStep[] } = {
    steps: expected.steps as ExpectedStep[],
  };

  if (normalizedExpected.steps.length === 0) {
    return {
      score: actual.steps.length === 0 ? 1 : 0,
      matchedSteps: 0,
      totalExpectedSteps: 0,
      totalActualSteps: actual.steps.length,
      missingSteps: [],
      extraSteps: actual.steps.map((s: TrajectoryStep) => s.name),
      outOfOrderSteps: [],
      repeatedSteps: [],
    };
  }

  const actualNames = actual.steps.map((s: TrajectoryStep) => s.name);

  // Detect repeated steps
  const nameCounts = new Map<string, number>();
  for (const name of actualNames) {
    nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
  }
  const repeatedSteps = [...nameCounts.entries()]
    .filter(([_, count]: [string, number]) => count > 1)
    .map(([name]: [string, number]) => name);

  if (ordering === 'strict') {
    return compareStrictOrder(actual, normalizedExpected, { allowRepeatedSteps, repeatedSteps });
  }

  if (ordering === 'unordered') {
    return compareUnorderedPresence(actual, normalizedExpected, { allowRepeatedSteps, repeatedSteps });
  }

  return compareRelaxedOrder(actual, normalizedExpected, { allowRepeatedSteps, repeatedSteps });
}

/**
 * Result of comparing two trajectories.
 */
export type TrajectoryComparisonResult = {
  /** Overall match score from 0 to 1 */
  score: number;
  /** Number of expected steps that were matched */
  matchedSteps: number;
  /** Total number of expected steps */
  totalExpectedSteps: number;
  /** Total number of actual steps taken */
  totalActualSteps: number;
  /** Expected steps that were not found in the actual trajectory */
  missingSteps: string[];
  /** Actual steps that were not in the expected trajectory */
  extraSteps: string[];
  /** Steps that appear but not in the expected position */
  outOfOrderSteps: string[];
  /** Steps that were repeated (appeared more than once) */
  repeatedSteps: string[];
};

function compareStrictOrder(
  actual: Trajectory,
  expected: { steps: ExpectedStep[] },
  opts: { allowRepeatedSteps: boolean; repeatedSteps: string[] },
): TrajectoryComparisonResult {
  const actualNames: string[] = actual.steps.map((s: TrajectoryStep) => s.name);
  const expectedNames: string[] = expected.steps.map((s: ExpectedStep) => s.name);

  // Strict: exact same sequence
  let matchedSteps = 0;
  const outOfOrderSteps: string[] = [];
  const matchedExpectedIndices = new Set<number>();
  const maxLen = Math.max(actualNames.length, expectedNames.length);

  for (let i = 0; i < maxLen; i++) {
    const actualName = actualNames[i];
    const expectedName = expectedNames[i];
    if (actualName === expectedName) {
      if (actual.steps[i] && expected.steps[i]) {
        if (expectedStepMatches(actual.steps[i]!, expected.steps[i]!)) {
          matchedSteps++;
          matchedExpectedIndices.add(i);
        }
      } else {
        matchedSteps++;
        matchedExpectedIndices.add(i);
      }
    } else if (actualName && expectedNames.includes(actualName)) {
      outOfOrderSteps.push(actualName);
    }
  }

  // Missing steps = expected steps that were not matched (accounts for stepType/data mismatches)
  const missingSteps: string[] = expectedNames.filter((_: string, i: number) => !matchedExpectedIndices.has(i));
  const extraSteps: string[] = actualNames.filter((name: string) => !expectedNames.includes(name));

  let score = matchedSteps / expected.steps.length;

  // Penalize extra steps in strict mode
  if (actualNames.length > expectedNames.length) {
    const extraPenalty = (actualNames.length - expectedNames.length) / expectedNames.length;
    score = Math.max(0, score - extraPenalty * 0.5);
  }

  // Penalize repeated steps if not allowed
  if (!opts.allowRepeatedSteps && opts.repeatedSteps.length > 0) {
    score = Math.max(0, score - opts.repeatedSteps.length * 0.1);
  }

  return {
    score: roundToTwoDecimals(Math.max(0, Math.min(1, score))),
    matchedSteps,
    totalExpectedSteps: expected.steps.length,
    totalActualSteps: actual.steps.length,
    missingSteps,
    extraSteps,
    outOfOrderSteps,
    repeatedSteps: opts.repeatedSteps,
  };
}

function compareRelaxedOrder(
  actual: Trajectory,
  expected: { steps: ExpectedStep[] },
  opts: { allowRepeatedSteps: boolean; repeatedSteps: string[] },
): TrajectoryComparisonResult {
  const actualNames: string[] = actual.steps.map((s: TrajectoryStep) => s.name);
  const expectedNames: string[] = expected.steps.map((s: ExpectedStep) => s.name);

  // Relaxed: expected steps must appear in order but extra steps are allowed
  let matchedSteps = 0;
  let lastMatchedIndex = -1;
  const outOfOrderSteps: string[] = [];
  const matchedExpectedIndices = new Set<number>();

  for (let i = 0; i < expectedNames.length; i++) {
    const expectedName = expectedNames[i];
    let found = false;

    for (let j = lastMatchedIndex + 1; j < actualNames.length; j++) {
      if (actualNames[j] === expectedName) {
        if (actual.steps[j] && expected.steps[i]) {
          if (expectedStepMatches(actual.steps[j]!, expected.steps[i]!)) {
            matchedSteps++;
            lastMatchedIndex = j;
            matchedExpectedIndices.add(i);
            found = true;
            break;
          }
        } else {
          matchedSteps++;
          lastMatchedIndex = j;
          matchedExpectedIndices.add(i);
          found = true;
          break;
        }
      }
    }

    if (!found) {
      // Check if the step exists but is out of order
      if (actualNames.includes(expectedName!)) {
        outOfOrderSteps.push(expectedName!);
      }
    }
  }

  // Missing steps = expected steps that were not matched (by name + stepType + data, not just name)
  const missingSteps = expectedNames.filter((_, i) => !matchedExpectedIndices.has(i));
  const expectedSet = new Set(expectedNames);
  const extraSteps = actualNames.filter(name => !expectedSet.has(name));

  let score = matchedSteps / expected.steps.length;

  // Penalize repeated steps if not allowed
  if (!opts.allowRepeatedSteps && opts.repeatedSteps.length > 0) {
    score = Math.max(0, score - opts.repeatedSteps.length * 0.1);
  }

  return {
    score: roundToTwoDecimals(Math.max(0, Math.min(1, score))),
    matchedSteps,
    totalExpectedSteps: expected.steps.length,
    totalActualSteps: actual.steps.length,
    missingSteps,
    extraSteps,
    outOfOrderSteps,
    repeatedSteps: opts.repeatedSteps,
  };
}

/**
 * Fields on each ExpectedStep variant that are comparable data (not structural).
 * Used by `expectedStepMatches` to know which fields to compare when `compareData` is true.
 */
const COMPARABLE_FIELDS_BY_TYPE: Record<string, string[]> = {
  tool_call: ['toolArgs', 'toolResult', 'success'],
  mcp_tool_call: ['toolArgs', 'toolResult', 'mcpServer', 'success'],
  model_generation: ['modelId', 'promptTokens', 'completionTokens', 'finishReason'],
  agent_run: ['agentId'],
  workflow_step: ['stepId', 'status', 'output'],
  workflow_run: ['workflowId', 'status'],
  workflow_conditional: ['conditionCount', 'selectedSteps'],
  workflow_parallel: ['branchCount', 'parallelSteps'],
  workflow_loop: ['loopType', 'totalIterations'],
  workflow_sleep: ['sleepDurationMs', 'sleepType'],
  workflow_wait_event: ['eventName', 'eventReceived'],
  processor_run: ['processorId'],
};

/**
 * Check if an actual TrajectoryStep matches an ExpectedStep.
 * Matches by name, optionally by stepType, and auto-compares any variant-specific
 * fields that are present on the expected step.
 */
function expectedStepMatches(actual: TrajectoryStep, expected: ExpectedStep): boolean {
  if (actual.name !== expected.name) return false;
  if (expected.stepType && actual.stepType !== expected.stepType) return false;

  if (expected.stepType) {
    const fields = COMPARABLE_FIELDS_BY_TYPE[expected.stepType] ?? [];
    for (const field of fields) {
      const expectedVal = (expected as any)[field];
      if (expectedVal === undefined) continue; // field not specified in expectation, skip
      const actualVal = (actual as any)[field];
      if (actualVal === undefined) return false;
      try {
        if (JSON.stringify(actualVal) !== JSON.stringify(expectedVal)) return false;
      } catch {
        return false;
      }
    }
  }

  return true;
}

function compareUnorderedPresence(
  actual: Trajectory,
  expected: { steps: ExpectedStep[] },
  opts: { allowRepeatedSteps: boolean; repeatedSteps: string[] },
): TrajectoryComparisonResult {
  const actualNames: string[] = actual.steps.map((s: TrajectoryStep) => s.name);
  const expectedNames: string[] = expected.steps.map((s: ExpectedStep) => s.name);

  let matchedSteps = 0;
  const matchedExpectedIndices = new Set<number>();
  const usedIndices = new Set<number>();
  for (let i = 0; i < expected.steps.length; i++) {
    const expectedStep = expected.steps[i]!;
    for (let j = 0; j < actual.steps.length; j++) {
      if (!usedIndices.has(j) && expectedStepMatches(actual.steps[j]!, expectedStep)) {
        matchedSteps++;
        matchedExpectedIndices.add(i);
        usedIndices.add(j);
        break;
      }
    }
  }

  // Missing steps = expected steps that were not matched (accounts for stepType/data mismatches)
  const missingSteps = expectedNames.filter((_, i) => !matchedExpectedIndices.has(i));
  const expectedSet = new Set(expectedNames);
  const extraSteps = actualNames.filter(name => !expectedSet.has(name));

  let score = matchedSteps / expected.steps.length;

  // Penalize repeated steps if not allowed
  if (!opts.allowRepeatedSteps && opts.repeatedSteps.length > 0) {
    score = Math.max(0, score - opts.repeatedSteps.length * 0.1);
  }

  return {
    score: roundToTwoDecimals(Math.max(0, Math.min(1, score))),
    matchedSteps,
    totalExpectedSteps: expected.steps.length,
    totalActualSteps: actual.steps.length,
    missingSteps,
    extraSteps,
    outOfOrderSteps: [], // ordering not checked in unordered mode
    repeatedSteps: opts.repeatedSteps,
  };
}

// ─── Efficiency evaluation ───

/**
 * Result of checking trajectory efficiency.
 */
export type TrajectoryEfficiencyResult = {
  /** Overall efficiency score from 0 to 1 */
  score: number;
  /** Total number of steps taken */
  totalSteps: number;
  /** Whether the step budget was exceeded */
  overStepBudget: boolean;
  /** Total tokens used across model_generation steps */
  totalTokens: number;
  /** Whether the token budget was exceeded */
  overTokenBudget: boolean;
  /** Total duration in milliseconds */
  totalDurationMs: number;
  /** Whether the duration budget was exceeded */
  overDurationBudget: boolean;
  /** Redundant calls detected (same tool + same args consecutively) */
  redundantCalls: Array<{ name: string; index: number }>;
};

/**
 * Evaluate trajectory efficiency against budgets and redundancy checks.
 */
export function checkTrajectoryEfficiency(
  trajectory: Trajectory,
  options: {
    maxSteps?: number;
    maxTotalTokens?: number;
    maxTotalDurationMs?: number;
    noRedundantCalls?: boolean;
  } = {},
): TrajectoryEfficiencyResult {
  const { maxSteps, maxTotalTokens, maxTotalDurationMs, noRedundantCalls = true } = options;

  const totalSteps = trajectory.steps.length;

  // Calculate total tokens from model_generation steps
  let totalTokens = 0;
  for (const step of trajectory.steps) {
    if (step.stepType === 'model_generation') {
      totalTokens += (step.promptTokens ?? 0) + (step.completionTokens ?? 0);
    }
  }

  // Calculate total duration
  const totalDurationMs =
    trajectory.totalDurationMs ?? trajectory.steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);

  // Detect redundant calls (same tool name + same args in consecutive calls)
  const redundantCalls: Array<{ name: string; index: number }> = [];
  if (noRedundantCalls) {
    for (let i = 1; i < trajectory.steps.length; i++) {
      const prev = trajectory.steps[i - 1]!;
      const curr = trajectory.steps[i]!;
      if (
        prev.name === curr.name &&
        prev.stepType === curr.stepType &&
        (prev.stepType === 'tool_call' || prev.stepType === 'mcp_tool_call')
      ) {
        const prevArgs = (prev as TrajectoryStep & { toolArgs?: Record<string, unknown> }).toolArgs;
        const currArgs = (curr as TrajectoryStep & { toolArgs?: Record<string, unknown> }).toolArgs;
        try {
          if (JSON.stringify(prevArgs) === JSON.stringify(currArgs)) {
            redundantCalls.push({ name: curr.name, index: i });
          }
        } catch {
          // If serialization fails, don't flag as redundant
        }
      }
    }
  }

  const overStepBudget = maxSteps !== undefined && totalSteps > maxSteps;
  const overTokenBudget = maxTotalTokens !== undefined && totalTokens > maxTotalTokens;
  const overDurationBudget = maxTotalDurationMs !== undefined && totalDurationMs > maxTotalDurationMs;

  // Calculate score: each dimension contributes equally
  const dimensions: number[] = [];

  if (maxSteps !== undefined) {
    dimensions.push(overStepBudget ? Math.max(0, 1 - (totalSteps - maxSteps) / maxSteps) : 1);
  }
  if (maxTotalTokens !== undefined) {
    dimensions.push(overTokenBudget ? Math.max(0, 1 - (totalTokens - maxTotalTokens) / maxTotalTokens) : 1);
  }
  if (maxTotalDurationMs !== undefined) {
    dimensions.push(
      overDurationBudget ? Math.max(0, 1 - (totalDurationMs - maxTotalDurationMs) / maxTotalDurationMs) : 1,
    );
  }
  if (noRedundantCalls) {
    dimensions.push(redundantCalls.length === 0 ? 1 : Math.max(0, 1 - redundantCalls.length * 0.2));
  }

  const score = dimensions.length > 0 ? dimensions.reduce((a, b) => a + b, 0) / dimensions.length : 1;

  return {
    score: roundToTwoDecimals(Math.max(0, Math.min(1, score))),
    totalSteps,
    overStepBudget,
    totalTokens,
    overTokenBudget,
    totalDurationMs,
    overDurationBudget,
    redundantCalls,
  };
}

// ─── Blacklist evaluation ───

/**
 * Result of checking trajectory against a blacklist.
 */
export type TrajectoryBlacklistResult = {
  /** Score: 1.0 if clean, 0.0 if any violation found */
  score: number;
  /** Individual blacklisted tools that were found */
  violatedTools: string[];
  /** Blacklisted sequences that were found */
  violatedSequences: string[][];
};

/**
 * Check if a trajectory violates any blacklist rules.
 * Returns score 0.0 if any violation is found (hard fail).
 */
export function checkTrajectoryBlacklist(
  trajectory: Trajectory,
  options: {
    blacklistedTools?: string[];
    blacklistedSequences?: string[][];
  } = {},
): TrajectoryBlacklistResult {
  const { blacklistedTools = [], blacklistedSequences = [] } = options;
  const violatedTools: string[] = [];
  const violatedSequences: string[][] = [];

  const stepNames = trajectory.steps.map(s => s.name);

  // Check blacklisted tools
  for (const forbidden of blacklistedTools) {
    if (stepNames.includes(forbidden)) {
      violatedTools.push(forbidden);
    }
  }

  // Check blacklisted sequences (contiguous subsequences)
  for (const sequence of blacklistedSequences) {
    if (sequence.length === 0) continue;
    for (let i = 0; i <= stepNames.length - sequence.length; i++) {
      let match = true;
      for (let j = 0; j < sequence.length; j++) {
        if (stepNames[i + j] !== sequence[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        violatedSequences.push(sequence);
        break; // Only report each sequence once
      }
    }
  }

  const hasViolations = violatedTools.length > 0 || violatedSequences.length > 0;

  return {
    score: hasViolations ? 0 : 1,
    violatedTools,
    violatedSequences,
  };
}

// ─── Tool failure analysis ───

/**
 * A detected tool failure pattern in the trajectory.
 */
export type ToolFailurePattern = {
  /** The tool name that experienced failure */
  toolName: string;
  /** Number of consecutive retries (same tool, same or similar args) */
  retryCount: number;
  /** Whether the agent fell back to a different tool after failures */
  fellBackToAlternative: boolean;
  /** The alternative tool used, if any */
  alternativeTool?: string;
  /** Whether any retry eventually succeeded */
  eventuallySucceeded: boolean;
};

/**
 * Result of analyzing tool failure patterns in a trajectory.
 */
export type ToolFailureAnalysisResult = {
  /** Score from 0 to 1 (lower = more failures/retries) */
  score: number;
  /** Tool failure patterns detected */
  patterns: ToolFailurePattern[];
  /** Total number of retries across all tools */
  totalRetries: number;
  /** Tools that exceeded the retry threshold */
  excessiveRetryTools: string[];
};

/**
 * Analyze tool failure and retry patterns in a trajectory.
 */
export function analyzeToolFailures(
  trajectory: Trajectory,
  options: {
    maxRetriesPerTool?: number;
  } = {},
): ToolFailureAnalysisResult {
  const { maxRetriesPerTool = 2 } = options;
  const patterns: ToolFailurePattern[] = [];
  let totalRetries = 0;

  const toolCallSteps = trajectory.steps.filter(s => s.stepType === 'tool_call' || s.stepType === 'mcp_tool_call');

  if (toolCallSteps.length === 0) {
    return { score: 1, patterns: [], totalRetries: 0, excessiveRetryTools: [] };
  }

  // Group consecutive calls to the same tool as potential retry sequences
  let i = 0;
  while (i < toolCallSteps.length) {
    const currentTool = toolCallSteps[i]!;
    let retryCount = 0;
    let j = i + 1;

    // Count consecutive calls to the same tool
    // (toolCallSteps is pre-filtered to tool_call/mcp_tool_call, so no stepType checks needed)
    while (j < toolCallSteps.length && toolCallSteps[j]!.name === currentTool.name) {
      const prevStep = toolCallSteps[j - 1]! as TrajectoryStep & { success?: boolean };
      if (prevStep.success === false) {
        retryCount++;
      }
      j++;
    }

    if (retryCount > 0) {
      // Check if agent fell back to a different tool after retries
      const nextDifferentTool = j < toolCallSteps.length ? toolCallSteps[j] : undefined;
      const lastRetry = toolCallSteps[j - 1]! as TrajectoryStep & { success?: boolean };
      const lastSuccess = lastRetry.success !== false;

      patterns.push({
        toolName: currentTool.name,
        retryCount,
        fellBackToAlternative: nextDifferentTool !== undefined && !lastSuccess,
        alternativeTool: nextDifferentTool !== undefined && !lastSuccess ? nextDifferentTool.name : undefined,
        eventuallySucceeded: lastSuccess,
      });

      totalRetries += retryCount;
    }

    i = j;
  }

  // Score: penalize excessive retries
  const excessiveRetryTools = patterns.filter(p => p.retryCount > maxRetriesPerTool).map(p => p.toolName);

  let score = 1;
  if (toolCallSteps.length > 0) {
    // Each retry beyond the threshold costs more
    const excessRetries = patterns.reduce((sum, p) => sum + Math.max(0, p.retryCount - maxRetriesPerTool), 0);
    score = Math.max(0, 1 - excessRetries * 0.2);
  }

  return {
    score: roundToTwoDecimals(Math.max(0, Math.min(1, score))),
    patterns,
    totalRetries,
    excessiveRetryTools,
  };
}
