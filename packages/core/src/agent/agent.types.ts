import type { ModelMessage, ToolChoice } from '@internal/ai-sdk-v5';
import type { MastraScorer, MastraScorers, ScoringSamplingConfig } from '../evals';
import type { SystemMessage, MastraModelConfig } from '../llm';
import type { ProviderOptions } from '../llm/model/provider-options';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { NetworkValidationConfig, ValidationContext } from '../loop/network/validation';
import type { LoopConfig, LoopOptions, PrepareStepFunction } from '../loop/types';
import type { TracingContext, TracingOptions } from '../observability';
import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow } from '../processors';
import type { RequestContext } from '../request-context';
import type { OutputSchema } from '../stream/base/schema';
import type { OutputWriter } from '../workflows/types';
import type { MessageListInput, Message } from './message-list';
import type { AgentMemoryOption, ToolsetsInput, ToolsInput, StructuredOutputOptions, AgentMethodType } from './types';

// ============================================================================
// Network Completion Types
// ============================================================================

/**
 * Context available to custom completion evaluators.
 */
export interface NetworkCompletionContext {
  /** The original task/prompt */
  task: string;
  /** Current iteration (1-based) */
  iteration: number;
  /** Maximum iterations allowed */
  maxIterations: number;
  /** Result from the last primitive execution */
  primitiveResult: string;
  /** Which primitive just executed */
  primitive: {
    id: string;
    type: 'agent' | 'workflow' | 'tool';
  };
  /** All messages in the conversation */
  messages: Message[];
  /** Thread ID (if using memory) */
  threadId?: string;
  /** Request context */
  requestContext: RequestContext;
}

/**
 * Result from a completion evaluator.
 */
export interface NetworkCompletionResult {
  /** Whether the task is complete */
  isComplete: boolean;
  /** The final result to return (if complete) */
  finalResult?: string;
  /** Reason for completion/continuation */
  reason?: string;
}

/**
 * Configuration for how the network evaluates task completion.
 */
export interface NetworkCompletionConfig {
  /**
   * Custom completion evaluator function.
   * When provided, replaces the default LLM-based completion evaluation.
   *
   * @example
   * ```typescript
   * completion: {
   *   evaluate: async (ctx) => {
   *     // Custom logic - maybe check a database, API, or file
   *     const result = await checkTaskStatus(ctx.task);
   *     return {
   *       isComplete: result.done,
   *       finalResult: result.output,
   *       reason: result.done ? 'Task completed successfully' : 'Still working...',
   *     };
   *   },
   * }
   * ```
   */
  evaluate?: (context: NetworkCompletionContext) => Promise<NetworkCompletionResult>;

  /**
   * Additional instructions appended to the default completion evaluation prompt.
   * Only used when `evaluate` is not provided.
   *
   * @example
   * ```typescript
   * completion: {
   *   additionalInstructions: `
   *     Consider the task complete only when:
   *     - All requested files have been created
   *     - No TODO comments remain in the code
   *   `,
   * }
   * ```
   */
  additionalInstructions?: string;

  /**
   * Model to use for completion evaluation.
   * Defaults to the routing agent's model.
   * Useful for using a faster/cheaper model for evaluation.
   */
  model?: MastraModelConfig;

  /**
   * Skip LLM completion evaluation entirely.
   * When true, the network runs until maxSteps or validation passes.
   * Useful when you only want programmatic validation.
   *
   * @default false
   */
  skipLLMEvaluation?: boolean;
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
export type NetworkOptions = {
  /** Memory configuration for conversation persistence and retrieval */
  memory?: AgentMemoryOption;

  /** Unique identifier for this execution run */
  runId?: string;

  /** Request Context containing dynamic configuration and state */
  requestContext?: RequestContext;

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
   * Completion configuration - controls how task completion is evaluated.
   */
  completion?: NetworkCompletionConfig;

  /**
   * Validation configuration for programmatic task completion verification.
   * When configured, runs external checks to verify task completion.
   *
   * @example
   * ```typescript
   * await agent.network(messages, {
   *   validation: {
   *     checks: [
   *       createCheck({ id: 'tests', name: 'Tests', run: async () => ... }),
   *     ],
   *     strategy: 'all',
   *     mode: 'verify',
   *   },
   * });
   * ```
   */
  validation?: NetworkValidationConfig;

  /**
   * Callback fired after each iteration completes.
   */
  onIterationComplete?: (context: {
    iteration: number;
    primitiveId: string;
    primitiveType: 'agent' | 'workflow' | 'tool';
    result: string;
    isComplete: boolean;
  }) => void | Promise<void>;
};

/**
 * @deprecated Use NetworkOptions instead
 */
export type MultiPrimitiveExecutionOptions = NetworkOptions;

export type AgentExecutionOptions<OUTPUT extends OutputSchema = undefined> = {
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
  requestContext?: RequestContext;

  /** @deprecated Use memory.resource instead. Identifier for the resource/user */
  resourceId?: string;
  /** @deprecated Use memory.thread instead. Thread identifier for conversation continuity */
  threadId?: string;

  /** Maximum number of steps to run */
  maxSteps?: number;

  /** Conditions for stopping execution (e.g., step count, token limit) */
  stopWhen?: LoopOptions['stopWhen'];

  /** Provider-specific options passed to the language model */
  providerOptions?: ProviderOptions;

  /** Callback fired after each execution step. */
  onStepFinish?: LoopConfig['onStepFinish'];
  /** Callback fired when execution completes. */
  onFinish?: LoopConfig['onFinish'];

  /** Callback fired for each streaming chunk received */
  onChunk?: LoopConfig<OUTPUT>['onChunk'];
  /** Callback fired when an error occurs during streaming */
  onError?: LoopConfig['onError'];
  /** Callback fired when streaming is aborted */
  onAbort?: LoopConfig['onAbort'];
  /** Tools that are active for this execution */
  activeTools?: LoopOptions['activeTools'];
  /**
   * Signal to abort the streaming operation
   */
  abortSignal?: LoopConfig['abortSignal'];

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

  /** Require approval for all tool calls */
  requireToolApproval?: boolean;

  /** Automatically resume suspended tools */
  autoResumeSuspendedTools?: boolean;

  /** Maximum number of tool calls to execute concurrently (default: 1 when approval may be required, otherwise 10) */
  toolCallConcurrency?: number;

  /** Structured output generation with enhanced developer experience  */
  structuredOutput?: StructuredOutputOptions<OUTPUT extends OutputSchema ? OUTPUT : never>;

  /** Whether to include raw chunks in the stream output (not available on all model providers) */
  includeRawChunks?: boolean;
};

export type InnerAgentExecutionOptions<OUTPUT extends OutputSchema = undefined> = AgentExecutionOptions<OUTPUT> & {
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
};
