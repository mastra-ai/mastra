import type { TelemetrySettings } from 'ai';
import type { ModelMessage, ToolChoice } from 'ai-v5';
import type { TracingContext, TracingOptions } from '../ai-tracing';
import type { SystemMessage } from '../llm';
import type { StreamTextOnFinishCallback, StreamTextOnStepFinishCallback } from '../llm/model/base.types';
import type { ProviderOptions } from '../llm/model/provider-options';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { LoopConfig, LoopOptions, PrepareStepFunction } from '../loop/types';
import type { InputProcessor, OutputProcessor } from '../processors';
import type { RuntimeContext } from '../runtime-context';
import type { MastraScorer, MastraScorers, ScoringSamplingConfig } from '../scores';
import type { OutputSchema } from '../stream/base/schema';
import type { ChunkType } from '../stream/types';
import type { MessageListInput } from './message-list';
import type { AgentMemoryOption, ToolsetsInput, ToolsInput, StructuredOutputOptions, AgentMethodType } from './types';

export type MultiPrimitiveExecutionOptions = {
  /** Memory configuration for conversation persistence and retrieval */
  memory?: AgentMemoryOption;
  /** Unique identifier for this execution run */
  runId?: string;

  /** Runtime context containing dynamic configuration and state */
  runtimeContext?: RuntimeContext;

  /** Maximum number of steps to run */
  maxSteps?: number;

  /** AI tracing context for span hierarchy and metadata */
  tracingContext?: TracingContext;

  /** Model-specific settings like temperature, maxTokens, topP, etc. */
  modelSettings?: LoopOptions['modelSettings'];

  telemetry?: TelemetrySettings;
};

export type AgentExecutionOptions<
  OUTPUT extends OutputSchema = undefined,
  FORMAT extends 'mastra' | 'aisdk' | undefined = undefined,
> = {
  /**
   * Determines the output stream format.
   * @deprecated When using format: 'aisdk', use the `@mastra/ai-sdk` package instead. See https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk#streaming
   */
  format?: FORMAT;

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

  /** Runtime context containing dynamic configuration and state */
  runtimeContext?: RuntimeContext;

  /** @deprecated Use memory.resource instead. Identifier for the resource/user */
  resourceId?: string;
  /** @deprecated Use memory.thread instead. Thread identifier for conversation continuity */
  threadId?: string;

  /** Telemetry collection settings for observability */
  telemetry?: TelemetrySettings;

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
  activeTools?: LoopConfig['activeTools'];
  /**
   * Signal to abort the streaming operation
   */
  abortSignal?: LoopConfig['abortSignal'];

  /** Input processors to use for this execution (overrides agent's default) */
  inputProcessors?: InputProcessor[];
  /** Output processors to use for this execution (overrides agent's default) */
  outputProcessors?: OutputProcessor[];

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
  /** AI tracing context for span hierarchy and metadata */
  tracingContext?: TracingContext;
  /** AI tracing options for starting new traces */
  tracingOptions?: TracingOptions;

  /** Callback function called before each step of multi-step execution */
  prepareStep?: PrepareStepFunction<any>;

  /** Require approval for all tool calls */
  requireToolApproval?: boolean;

  /** Structured output generation with enhanced developer experience  */
  structuredOutput?: StructuredOutputOptions<OUTPUT extends OutputSchema ? OUTPUT : never>;

  /** Whether to include raw chunks in the stream output (not available on all model providers) */
  includeRawChunks?: boolean;
};

export type DeprecatedOutputOptions<OUTPUT extends OutputSchema = undefined> = {
  /** Schema for structured output generation (Zod schema or JSON Schema)
   * @deprecated Use `structuredOutput.schema` instead. The `output` property will be removed in a future version.
   */
  output?: OUTPUT;
};

export type InnerAgentExecutionOptions<
  OUTPUT extends OutputSchema = undefined,
  FORMAT extends 'aisdk' | 'mastra' | undefined = undefined,
> = AgentExecutionOptions<OUTPUT, FORMAT> & {
  writableStream?: WritableStream<ChunkType>;
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
