import type { JSONSchema7 } from '@ai-sdk/provider';
import type { TelemetrySettings } from 'ai';
import type { ModelMessage, ToolChoice } from 'ai-v5';
import type { z } from 'zod';
import type { ZodSchema as ZodSchemaV3 } from 'zod/v3';
import type { ZodAny } from 'zod/v4';
import type { TracingContext } from '../ai-tracing';
import type { StreamTextOnFinishCallback, StreamTextOnStepFinishCallback } from '../llm/model/base.types';
import type { LoopConfig, LoopOptions } from '../loop/types';
import type { InputProcessor, OutputProcessor } from '../processors';
import type { RuntimeContext } from '../runtime-context';
import type { MastraScorer, MastraScorers, ScoringSamplingConfig } from '../scores';
import type { OutputSchema } from '../stream/base/schema';
import type { ChunkType } from '../stream/types';
import type { MessageListInput } from './message-list';
import type { AgentMemoryOption, ToolsetsInput, ToolsInput, StructuredOutputOptions } from './types';

export type AgentExecutionOptions<
  OUTPUT extends OutputSchema | undefined = undefined,
  STRUCTURED_OUTPUT extends ZodSchemaV3 | ZodAny | JSONSchema7 | undefined = undefined,
  FORMAT extends 'mastra' | 'aisdk' | undefined = undefined,
> = {
  /**
   * Determines the output stream format. Use 'mastra' for Mastra's native format (default) or 'aisdk' for AI SDK v5 compatibility.
   * @default 'mastra'
   */
  format?: FORMAT;

  /** Custom instructions that override the agent's default instructions for this execution */
  instructions?: string;

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

  /** Schema for structured output generation (Zod schema or JSON Schema) @experimental */
  output?: OUTPUT;

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
  providerOptions?: LoopOptions['providerOptions'];

  /** Advanced loop configuration options */
  options?: Omit<LoopConfig, 'onStepFinish' | 'onFinish'>;

  /** Callback fired after each execution step. Type varies by format */
  onStepFinish?: FORMAT extends 'aisdk' ? StreamTextOnStepFinishCallback<any> : LoopConfig['onStepFinish'];
  /** Callback fired when execution completes. Type varies by format */
  onFinish?: FORMAT extends 'aisdk' ? StreamTextOnFinishCallback<any> : LoopConfig['onFinish'];

  /** Input processors to use for this execution (overrides agent's default) */
  inputProcessors?: InputProcessor[];
  /** Output processors to use for this execution (overrides agent's default) */
  outputProcessors?: OutputProcessor[];
  /** Structured output generation with enhanced developer experience  @experimental */
  structuredOutput?: STRUCTURED_OUTPUT extends z.ZodTypeAny ? StructuredOutputOptions<STRUCTURED_OUTPUT> : never;

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
};

export type InnerAgentExecutionOptions<
  OUTPUT extends OutputSchema | undefined = undefined,
  FORMAT extends 'aisdk' | 'mastra' | undefined = undefined,
> = AgentExecutionOptions<OUTPUT, any, FORMAT> & {
  writableStream?: WritableStream<ChunkType>;
  messages: MessageListInput;
  methodType: 'generate' | 'stream' | 'streamVNext';
};
