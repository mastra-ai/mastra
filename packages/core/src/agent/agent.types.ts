import type { ModelMessage, ToolChoice } from '@internal/ai-sdk-v5';
import type { MastraScorer, MastraScorers, ScoringSamplingConfig } from '../evals';
import type { SystemMessage } from '../llm';
import type { ProviderOptions } from '../llm/model/provider-options';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { CompletionConfig, CompletionRunResult } from '../loop/network/validation';
import type { LoopConfig, LoopOptions, PrepareStepFunction } from '../loop/types';
import type { TracingContext, TracingOptions } from '../observability';
import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow } from '../processors';
import type { RequestContext } from '../request-context';
import type { OutputWriter } from '../workflows/types';
import type { MessageListInput } from './message-list';
import type {
  AgentMemoryOption,
  ToolsetsInput,
  ToolsInput,
  StructuredOutputOptions,
  AgentMethodType,
  MastraDBMessage,
} from './types';

// Re-export types for convenience
export type { CompletionConfig, CompletionRunResult } from '../loop/network/validation';

export type IsTaskCompleteConfig = CompletionConfig;

export type IsTaskCompleteRunResult = CompletionRunResult;

/**
 * Configuration for stream/generate isTaskComplete scoring.
 * Reuses the same IsTaskCompleteConfig as network for consistency.
 */
export type StreamIsTaskCompleteConfig = IsTaskCompleteConfig;

// ============================================================================
// Delegation Hook Types
// ============================================================================

/**
 * Context passed to the messageFilter callback.
 * Contains everything needed to decide which parent messages to share with the sub-agent.
 */
export interface MessageFilterContext {
  /** Full unfiltered messages from the parent agent's conversation history */
  messages: MastraDBMessage[];
  /** The ID of the primitive being delegated to */
  primitiveId: string;
  /** The type of primitive being delegated to */
  primitiveType: 'agent' | 'workflow';
  /** The prompt being sent to the sub-agent (after any onDelegationStart modifications) */
  prompt: string;
  /** Current iteration number (1-based) */
  iteration: number;
  /** ID of the current run */
  runId: string;
  /** Current thread ID (if using memory) */
  threadId?: string;
  /** Resource ID (if using memory) */
  resourceId?: string;
  /** The parent agent's ID */
  parentAgentId: string;
  /** The parent agent's name */
  parentAgentName: string;
  /** Tool call ID from the LLM */
  toolCallId: string;
}

/**
 * Context passed to the onDelegationStart hook.
 * Contains information about the sub-agent or workflow being called.
 */
export interface DelegationStartContext {
  /** The ID of the delegated primitive (agent or workflow) */
  primitiveId: string;
  /** The type of primitive being delegated to */
  primitiveType: 'agent' | 'workflow';
  /** The prompt being sent to the sub-agent/workflow */
  prompt: string;
  /** Additional parameters from the tool call */
  params: {
    threadId?: string;
    resourceId?: string;
    instructions?: string;
    maxSteps?: number;
  };
  /** Current iteration number (1-based) */
  iteration: number;
  /** ID of the current run */
  runId: string;
  /** Current thread ID (if using memory) */
  threadId?: string;
  /** Resource ID (if using memory) */
  resourceId?: string;
  /** The parent agent's ID */
  parentAgentId: string;
  /** The parent agent's name */
  parentAgentName: string;
  /** Tool call ID from the LLM */
  toolCallId: string;
  /** Messages accumulated so far */
  messages: MastraDBMessage[];
}

/**
 * Result returned from onDelegationStart hook.
 */
export interface DelegationStartResult {
  /** Whether to proceed with the delegation (default: true) */
  proceed?: boolean;
  /** Reason for rejection (used when proceed=false) */
  rejectionReason?: string;
  /** Modified prompt to send to the sub-agent (optional) */
  modifiedPrompt?: string;
  /** Modified instructions for the sub-agent (optional) */
  modifiedInstructions?: string;
  /** Modified maxSteps for the sub-agent (optional) */
  modifiedMaxSteps?: number;
}

/**
 * Handler for delegation start events.
 * Return result to modify or reject delegation, or void/undefined to proceed as-is.
 */
export type OnDelegationStartHandler = (
  context: DelegationStartContext,
) => DelegationStartResult | void | Promise<DelegationStartResult | void>;

/**
 * Context passed to the onDelegationComplete hook.
 */
export interface DelegationCompleteContext {
  /** The ID of the delegated primitive */
  primitiveId: string;
  /** The type of primitive */
  primitiveType: 'agent' | 'workflow';
  /** The prompt that was sent */
  prompt: string;
  /** The result from the sub-agent/workflow */
  result: {
    text: string;
    subAgentThreadId?: string;
    subAgentResourceId?: string;
  };
  /** Duration of the delegation in milliseconds */
  duration: number;
  /** Whether the delegation succeeded */
  success: boolean;
  /** Error if the delegation failed */
  error?: Error;
  /** Current iteration number (1-based) */
  iteration: number;
  /** ID of the current run */
  runId: string;
  /** Tool call ID from the LLM */
  toolCallId: string;
  /** The parent agent's ID */
  parentAgentId: string;
  /** The parent agent's name */
  parentAgentName: string;
  /** Messages accumulated so far (including the delegation result) */
  messages: MastraDBMessage[];
  /**
   * Call this function to stop all other concurrent delegations.
   * Only relevant when multiple tool calls are executed concurrently.
   */
  bail: () => void;
}

/**
 * Result returned from onDelegationComplete hook.
 */
export interface DelegationCompleteResult {
  /** Optional feedback to add to the conversation */
  feedback?: string;
}

/**
 * Handler for delegation complete events.
 */
export type OnDelegationCompleteHandler = (
  context: DelegationCompleteContext,
) => DelegationCompleteResult | void | Promise<DelegationCompleteResult | void>;

// ============================================================================
// Iteration Hook Types
// ============================================================================

/**
 * Context passed to the onIterationComplete hook.
 */
export interface IterationCompleteContext {
  /** Current iteration number (1-based) */
  iteration: number;
  /** Maximum iterations allowed */
  maxIterations?: number;
  /** The text output from this iteration */
  text: string;
  /** Tool calls made in this iteration */
  toolCalls: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
  /** Tool results from this iteration */
  toolResults: Array<{
    id: string;
    name: string;
    result: unknown;
    error?: Error;
  }>;
  /** Whether this is the final iteration (model returned stop or max iterations reached) */
  isFinal: boolean;
  /** The reason the model stopped */
  finishReason: string;
  /** ID of the current run */
  runId: string;
  /** Current thread ID (if using memory) */
  threadId?: string;
  /** Resource ID (if using memory) */
  resourceId?: string;
  /** Agent ID */
  agentId: string;
  /** Agent name */
  agentName: string;
  /** All messages in the conversation */
  messages: MastraDBMessage[];
}

/**
 * Result returned from onIterationComplete hook.
 */
export interface IterationCompleteResult {
  /**
   * Whether to continue to the next iteration.
   * - true: Continue to next iteration
   * - false: Stop processing (even if model wants to continue)
   * - undefined: Let the model decide
   */
  continue?: boolean;
  /**
   * Feedback message to add to the conversation before the next iteration.
   * This allows injecting guidance to the LLM between iterations.
   */
  feedback?: string;
}

/**
 * Handler for iteration complete events.
 */
export type OnIterationCompleteHandler = (
  context: IterationCompleteContext,
) => IterationCompleteResult | void | Promise<IterationCompleteResult | void>;

// ============================================================================
// Delegation Configuration
// ============================================================================

/**
 * Configuration for delegation behavior during execution.
 */
export interface DelegationConfig {
  /**
   * Hook called before a subagent is executed.
   * Can reject or modify the delegation.
   */
  onDelegationStart?: OnDelegationStartHandler;

  /**
   * Hook called after a subagent execution completes.
   * Can provide feedback or stop processing.
   */
  onDelegationComplete?: OnDelegationCompleteHandler;

  /**
   * Callback that controls which parent messages are passed to each subagent as conversation
   * context. Receives the full parent message history along with delegation metadata, and
   * returns the messages that should be forwarded.
   *
   * Runs after `onDelegationStart` so the `prompt` reflects any modifications made there.
   *
   * @example
   * ```typescript
   * messageFilter: ({ messages, primitiveId, prompt }) => {
   *   // Pass only the last 5 messages, excluding tool calls
   *   return messages
   *     .filter(m => !m.content?.parts?.some(p => p.type === 'tool-invocation'))
   *     .slice(-5);
   * }
   * ```
   */
  messageFilter?: (context: MessageFilterContext) => MastraDBMessage[] | Promise<MastraDBMessage[]>;
}

/**
 * Configuration for the routing agent's behavior.
 */
export interface NetworkRoutingConfig {
  /**
   * Additional instructions appended to the routing agent's system prompt.
   *
   * @example
   * ```typescript
   * routing: {
   *   additionalInstructions: `
   *     Prefer using the 'coder' agent for implementation tasks.
   *     Always use the 'reviewer' agent before marking complete.
   *   `,
   * }
   * ```
   */
  additionalInstructions?: string;

  /**
   * Whether to include verbose reasoning about why primitives were/weren't selected.
   * @default false
   */
  verboseIntrospection?: boolean;
}

/**
 * Full configuration options for agent.network() execution.
 */
export type NetworkOptions<OUTPUT = undefined> = {
  /** Memory configuration for conversation persistence and retrieval */
  memory?: AgentMemoryOption;

  /** Whether to automatically resume suspended tools */
  autoResumeSuspendedTools?: boolean;

  /** Unique identifier for this execution run */
  runId?: string;

  /** Request Context containing dynamic configuration and state */
  requestContext?: RequestContext<any>;

  /** Maximum number of iterations to run */
  maxSteps?: number;

  /** Tracing context for span hierarchy and metadata */
  tracingContext?: TracingContext;

  /** Model-specific settings like temperature, maxTokens, topP, etc. */
  modelSettings?: LoopOptions['modelSettings'];

  /**
   * Routing configuration - controls how primitives are selected.
   */
  routing?: NetworkRoutingConfig;

  /**
   * Completion configuration - controls when the task is considered done.
   *
   * Uses MastraScorers that return 0 (not complete) or 1 (complete).
   * By default, the LLM evaluates completion.
   *
   * @example
   * ```typescript
   * import { createScorer } from '@mastra/core/evals';
   *
   * const testsScorer = createScorer({
   *   id: 'tests',
   *   description: 'Run tests',
   * }).generateScore(async () => {
   *   const result = await exec('npm test');
   *   return result.exitCode === 0 ? 1 : 0;
   * });
   *
   * // Use scorers for completion
   * completion: {
   *   scorers: [testsScorer],
   * }
   * ```
   */
  completion?: CompletionConfig;

  /**
   * Callback fired after each iteration completes.
   */
  onIterationComplete?: (context: {
    iteration: number;
    primitiveId: string;
    primitiveType: 'agent' | 'workflow' | 'tool' | 'none';
    result: string;
    isComplete: boolean;
  }) => void | Promise<void>;

  /**
   * Structured output configuration for the network's final result.
   * When provided, the network will generate a structured response matching the schema.
   *
   * @example
   * ```typescript
   * import { z } from 'zod';
   *
   * const resultSchema = z.object({
   *   summary: z.string(),
   *   recommendations: z.array(z.string()),
   *   confidence: z.number(),
   * });
   *
   * const stream = await agent.network(task, {
   *   structuredOutput: {
   *     schema: resultSchema,
   *   },
   * });
   *
   * // Get typed result
   * const result = await stream.object;
   * ```
   */
  structuredOutput?: StructuredOutputOptions<OUTPUT extends {} ? OUTPUT : never>;

  /** Callback fired when streaming is aborted */
  onAbort?: LoopConfig<OUTPUT>['onAbort'];

  /**
   * Signal to abort the streaming operation
   */
  abortSignal?: LoopConfig<OUTPUT>['abortSignal'];
};

/**
 * @deprecated Use NetworkOptions instead
 */
export type MultiPrimitiveExecutionOptions<OUTPUT = undefined> = NetworkOptions<OUTPUT>;

export type AgentExecutionOptionsBase<OUTPUT> = {
  /** Custom instructions that override the agent's default instructions for this execution */
  instructions?: SystemMessage;

  /** Custom system message to include in the prompt */
  system?: SystemMessage;

  /** Additional context messages to provide to the agent */
  context?: ModelMessage[];

  /** Memory configuration for conversation persistence and retrieval */
  memory?: AgentMemoryOption;

  /** Unique identifier for this execution run */
  runId?: string;

  /** Save messages incrementally after each stream step completes (default: false). */
  savePerStep?: boolean;

  /** Request Context containing dynamic configuration and state */
  requestContext?: RequestContext<any>; // @TODO: Figure out how to type this without breaking all the inner types

  /** Maximum number of steps to run */
  maxSteps?: number;

  /** Conditions for stopping execution (e.g., step count, token limit) */
  stopWhen?: LoopOptions['stopWhen'];

  /** Provider-specific options passed to the language model */
  providerOptions?: ProviderOptions;

  /** Callback fired after each execution step. */
  onStepFinish?: LoopConfig<OUTPUT>['onStepFinish'];
  /** Callback fired when execution completes. */
  onFinish?: LoopConfig<OUTPUT>['onFinish'];

  /** Callback fired for each streaming chunk received */
  onChunk?: LoopConfig<OUTPUT>['onChunk'];
  /** Callback fired when an error occurs during streaming */
  onError?: LoopConfig<OUTPUT>['onError'];
  /** Callback fired when streaming is aborted */
  onAbort?: LoopConfig<OUTPUT>['onAbort'];
  /** Tools that are active for this execution */
  activeTools?: LoopOptions['activeTools'];
  /**
   * Signal to abort the streaming operation
   */
  abortSignal?: LoopConfig<OUTPUT>['abortSignal'];

  /** Input processors to use for this execution (overrides agent's default) */
  inputProcessors?: InputProcessorOrWorkflow[];
  /** Output processors to use for this execution (overrides agent's default) */
  outputProcessors?: OutputProcessorOrWorkflow[];
  /**
   * Maximum number of times processors can trigger a retry for this generation.
   * Overrides agent's default maxProcessorRetries.
   * If not set, defaults to the agent's maxProcessorRetries (which defaults to no retries if also unset).
   */
  maxProcessorRetries?: number;

  /** Additional tool sets that can be used for this execution */
  toolsets?: ToolsetsInput;
  /** Client-side tools available during execution */
  clientTools?: ToolsInput;
  /** Tool selection strategy: 'auto', 'none', 'required', or specific tools */
  toolChoice?: ToolChoice<any>;

  /** Model-specific settings like temperature, maxTokens, topP, etc. */
  modelSettings?: LoopOptions['modelSettings'];

  /** Evaluation scorers to run on the execution results */
  scorers?: MastraScorers | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>;
  /** Whether to return detailed scoring data in the response */
  returnScorerData?: boolean;
  /** tracing context for span hierarchy and metadata */
  tracingContext?: TracingContext;
  /** tracing options for starting new traces */
  tracingOptions?: TracingOptions;

  /** Callback function called before each step of multi-step execution */
  prepareStep?: PrepareStepFunction;

  /**
   * IsTaskComplete scoring configuration for supervisor patterns.
   * Scorers evaluate whether the task is complete after each iteration.
   *
   * When scorers fail, feedback is automatically added to the message list
   * so the LLM can see why the task isn't complete and adjust its approach.
   *
   * @example
   * ```typescript
   * import { createScorer } from '@mastra/core/evals';
   *
   * const citationScorer = createScorer({
   *   id: 'citations',
   *   description: 'Check for citations',
   * }).generateScore(async ({ run }) => {
   *   const hasCitations = run.output.includes('[1]');
   *   return hasCitations ? 1 : 0;
   * });
   *
   * await supervisor.stream('Write a paper with citations', {
   *   isTaskComplete: {
   *     scorers: [citationScorer],
   *     strategy: 'all', // All scorers must pass
   *   },
   * });
   * ```
   */
  isTaskComplete?: StreamIsTaskCompleteConfig;

  /** Require approval for all tool calls */
  requireToolApproval?: boolean;

  /** Automatically resume suspended tools */
  autoResumeSuspendedTools?: boolean;

  /** Maximum number of tool calls to execute concurrently (default: 1 when approval may be required, otherwise 10) */
  toolCallConcurrency?: number;

  /** Whether to include raw chunks in the stream output (not available on all model providers) */
  includeRawChunks?: boolean;

  /**
   * Callback fired after each iteration (LLM call) completes.
   * Can control whether to continue and inject feedback.
   *
   * @example
   * ```typescript
   * await agent.stream('Build a feature', {
   *   onIterationComplete: ({ iteration, toolCalls, text }) => {
   *     if (iteration > 5 && !text.includes('done')) {
   *       return {
   *         continue: false,
   *         feedback: 'Please wrap up and provide a summary.',
   *       };
   *     }
   *   },
   * });
   * ```
   */
  onIterationComplete?: OnIterationCompleteHandler;

  /**
   * Delegation configuration for sub-agent and workflow tool calls.
   * Provides hooks for intercepting, modifying, or rejecting delegations.
   *
   * @example
   * ```typescript
   * await supervisor.stream('Research and code', {
   *   delegation: {
   *     onDelegationStart: ({ primitiveId }) => {
   *       // Reject certain delegations
   *       if (primitiveId === 'dangerous-agent') {
   *         return { proceed: false, rejectionReason: 'Not allowed' };
   *       }
   *       // Modify the prompt
   *       return { modifiedPrompt: `[PRIORITY] ${prompt}` };
   *     },
   *     onDelegationComplete: ({ primitiveId, result, bail }) => {
   *       // Stop all concurrent work when coding is done
   *       if (primitiveId === 'coder' && result.text.includes('DONE')) {
   *         bail();
   *       }
   *     },
   *   },
   * });
   * ```
   */
  delegation?: DelegationConfig;
};

export type AgentExecutionOptions<OUTPUT = unknown> = AgentExecutionOptionsBase<OUTPUT> &
  (OUTPUT extends {} ? { structuredOutput: StructuredOutputOptions<OUTPUT> } : { structuredOutput?: never });

export type InnerAgentExecutionOptions<OUTPUT = unknown> = AgentExecutionOptionsBase<OUTPUT> & {
  outputWriter?: OutputWriter;
  messages: MessageListInput;
  methodType: AgentMethodType;
  /** Internal: Model override for when structuredOutput.model is used with maxSteps=1 */
  model?: MastraLanguageModel;
  /** Internal: Whether the execution is a resume */
  resumeContext?: {
    resumeData: any;
    snapshot: any;
  };
  toolCallId?: string;
} & (OUTPUT extends {} ? { structuredOutput: StructuredOutputOptions<OUTPUT> } : { structuredOutput?: never });
