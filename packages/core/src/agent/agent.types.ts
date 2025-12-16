import type { ModelMessage, ToolChoice } from '@internal/ai-sdk-v5';
import type { MastraScorer, MastraScorers, ScoringSamplingConfig } from '../evals';
import type { SystemMessage } from '../llm';
import type { StreamTextOnFinishCallback, StreamTextOnStepFinishCallback } from '../llm/model/base.types';
import type { ProviderOptions } from '../llm/model/provider-options';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { LoopConfig, LoopOptions, PrepareStepFunction } from '../loop/types';
import type { TracingContext, TracingOptions } from '../observability';
import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow } from '../processors';
import type { RequestContext } from '../request-context';
import type { OutputSchema } from '../stream/base/schema';
import type { OutputWriter } from '../workflows/types';
import type { MessageListInput } from './message-list';
import type { AgentMemoryOption, ToolsetsInput, ToolsInput, StructuredOutputOptions, AgentMethodType } from './types';

export type MultiPrimitiveExecutionOptions = {
  /** Memory configuration for conversation persistence and retrieval */
  memory?: AgentMemoryOption;
  /** Unique identifier for this execution run */
  runId?: string;

  /** Request Context containing dynamic configuration and state */
  requestContext?: RequestContext;

  /** Maximum number of steps to run */
  maxSteps?: number;

  /** tracing context for span hierarchy and metadata */
  tracingContext?: TracingContext;

  /** Model-specific settings like temperature, maxTokens, topP, etc. */
  modelSettings?: LoopOptions['modelSettings'];
};

export type AgentExecutionOptions<
  OUTPUT extends OutputSchema = undefined,
  FORMAT extends 'mastra' | 'aisdk' | undefined = undefined,
> = {
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

  /** Callback fired after each execution step. Type varies by format */
  onStepFinish?: FORMAT extends 'aisdk' ? StreamTextOnStepFinishCallback<any> : LoopConfig['onStepFinish'];
  /** Callback fired when execution completes. Type varies by format */
  onFinish?: FORMAT extends 'aisdk' ? StreamTextOnFinishCallback<any> : LoopConfig['onFinish'];

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

export type InnerAgentExecutionOptions<
  OUTPUT extends OutputSchema = undefined,
  FORMAT extends 'aisdk' | 'mastra' | undefined = undefined,
> = AgentExecutionOptions<OUTPUT, FORMAT> & {
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
