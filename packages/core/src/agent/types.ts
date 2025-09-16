import type { GenerateTextOnStepFinishCallback, TelemetrySettings } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodSchema, ZodTypeAny } from 'zod';
import type { TracingContext, TracingOptions, TracingPolicy } from '../ai-tracing';
import type { Metric } from '../eval';
import type {
  CoreMessage,
  DefaultLLMStreamOptions,
  DefaultLLMStreamObjectOptions,
  DefaultLLMTextObjectOptions,
  DefaultLLMTextOptions,
  OutputType,
} from '../llm';
import type {
  StreamTextOnFinishCallback,
  StreamTextOnStepFinishCallback,
  StreamObjectOnFinishCallback,
} from '../llm/model/base.types';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import type { MemoryConfig, StorageThreadType } from '../memory/types';
import type { InputProcessor, OutputProcessor } from '../processors/index';
import type { RuntimeContext } from '../runtime-context';
import type { MastraScorer, MastraScorers, ScoringSamplingConfig } from '../scores';
import type { ModelManagerModelConfig } from '../stream/types';
import type { ToolAction, VercelTool, VercelToolV5 } from '../tools';
import type { DynamicArgument } from '../types';
import type { CompositeVoice } from '../voice';
import type { Workflow } from '../workflows';
import type { Agent } from './agent';
import type { AgentExecutionOptions } from './agent.types';

export type { MastraMessageV2, MastraMessageContentV2, UIMessageWithMetadata, MessageList } from './message-list/index';
export type { Message as AiMessageType } from 'ai';

export type ToolsInput = Record<string, ToolAction<any, any, any> | VercelTool | VercelToolV5>;

export type ToolsetsInput = Record<string, ToolsInput>;

type FallbackFields<S extends ZodTypeAny> =
  | { errorStrategy?: 'strict' | 'warn'; fallbackValue?: never }
  | { errorStrategy: 'fallback'; fallbackValue: z.infer<S> };

export type StructuredOutputOptions<S extends ZodTypeAny = ZodTypeAny> = {
  /** Zod schema to validate the output against */
  schema: S;

  /** Model to use for the internal structuring agent. If not provided, falls back to the agent's model */
  model?: MastraLanguageModel;

  /**
   * Custom instructions for the structuring agent.
   * If not provided, will generate instructions based on the schema.
   */
  instructions?: string;
} & FallbackFields<S>;

export interface AgentCreateOptions {
  tracingPolicy?: TracingPolicy;
}

export interface AgentConfig<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TMetrics extends Record<string, Metric> = Record<string, Metric>,
> {
  id?: TAgentId;
  name: TAgentId;
  description?: string;
  instructions: DynamicArgument<string>;
  model:
    | DynamicArgument<MastraLanguageModel>
    | {
        model: DynamicArgument<MastraLanguageModel>;
        maxRetries?: number; //defaults to 0
        enabled?: boolean; //defaults to true
      }[];
  maxRetries?: number; //defaults to 0
  tools?: DynamicArgument<TTools>;
  workflows?: DynamicArgument<Record<string, Workflow>>;
  defaultGenerateOptions?: DynamicArgument<AgentGenerateOptions>;
  defaultStreamOptions?: DynamicArgument<AgentStreamOptions>;
  defaultVNextStreamOptions?: DynamicArgument<AgentExecutionOptions>;
  mastra?: Mastra;
  agents?: DynamicArgument<Record<string, Agent>>;
  scorers?: DynamicArgument<MastraScorers>;
  evals?: TMetrics;
  memory?: DynamicArgument<MastraMemory>;
  voice?: CompositeVoice;
  inputProcessors?: DynamicArgument<InputProcessor[]>;
  outputProcessors?: DynamicArgument<OutputProcessor[]>;
  options?: AgentCreateOptions;
}

export type AgentMemoryOption = {
  thread: string | (Partial<StorageThreadType> & { id: string });
  resource: string;
  options?: MemoryConfig;
  readOnly?: boolean;
};

/**
 * Options for generating responses with an agent
 * @template OUTPUT - The schema type for structured output (Zod schema or JSON schema)
 * @template EXPERIMENTAL_OUTPUT - The schema type for structured output generation alongside tool calls (Zod schema or JSON schema)
 */
export type AgentGenerateOptions<
  OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
> = {
  /** Optional instructions to override the agent's default instructions */
  instructions?: string;
  /** Additional tool sets that can be used for this generation */
  toolsets?: ToolsetsInput;
  clientTools?: ToolsInput;
  /** Additional context messages to include */
  context?: CoreMessage[];
  /**
   * @deprecated Use the `memory` property instead for all memory-related options.
   */
  memoryOptions?: MemoryConfig;
  /** New memory options (preferred) */
  memory?: AgentMemoryOption;
  /** Unique ID for this generation run */
  runId?: string;
  /** Callback fired after each generation step completes */
  onStepFinish?: OUTPUT extends undefined ? GenerateTextOnStepFinishCallback<any> : never;
  /** Maximum number of steps allowed for generation */
  maxSteps?: number;
  /** Schema for structured output, does not work with tools, use experimental_output instead */
  output?: OutputType | OUTPUT;
  /** Schema for structured output generation alongside tool calls. */
  experimental_output?: EXPERIMENTAL_OUTPUT;
  /**
   * Structured output configuration using StructuredOutputProcessor.
   * This provides better DX than manually creating the processor.
   */
  structuredOutput?: EXPERIMENTAL_OUTPUT extends z.ZodTypeAny ? StructuredOutputOptions<EXPERIMENTAL_OUTPUT> : never;
  /** Controls how tools are selected during generation */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  /** Telemetry settings */
  telemetry?: TelemetrySettings;
  /** RuntimeContext for dependency injection */
  runtimeContext?: RuntimeContext;
  /** Scorers to use for this generation */
  scorers?: MastraScorers | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>;
  /** Whether to return the input required to run scorers for agents, defaults to false */
  returnScorerData?: boolean;
  /**
   * Whether to save messages incrementally on step finish
   * @default false
   */
  savePerStep?: boolean;
  /** Input processors to use for this generation call (overrides agent's default) */
  inputProcessors?: InputProcessor[];
  /** Output processors to use for this generation call (overrides agent's default) */
  outputProcessors?: OutputProcessor[];
  /** AI tracing context for span hierarchy and metadata */
  tracingContext?: TracingContext;
  /** AI tracing options for starting new traces */
  tracingOptions?: TracingOptions;
} & (
  | {
      /**
       * @deprecated Use the `memory` property instead for all memory-related options.
       */
      resourceId?: undefined;
      /**
       * @deprecated Use the `memory` property instead for all memory-related options.
       */
      threadId?: undefined;
    }
  | {
      /**
       * @deprecated Use the `memory` property instead for all memory-related options.
       */
      resourceId: string;
      /**
       * @deprecated Use the `memory` property instead for all memory-related options.
       */
      threadId: string;
    }
) &
  (OUTPUT extends undefined ? DefaultLLMTextOptions : DefaultLLMTextObjectOptions);

/**
 * Options for streaming responses with an agent
 * @template OUTPUT - The schema type for structured output (Zod schema or JSON schema)
 * @template EXPERIMENTAL_OUTPUT - The schema type for structured output generation alongside tool calls (Zod schema or JSON schema)
 */
export type AgentStreamOptions<
  OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
> = {
  /** Optional instructions to override the agent's default instructions */
  instructions?: string;
  /** Additional tool sets that can be used for this generation */
  toolsets?: ToolsetsInput;
  clientTools?: ToolsInput;
  /** Additional context messages to include */
  context?: CoreMessage[];
  /**
   * @deprecated Use the `memory` property instead for all memory-related options.
   */
  memoryOptions?: MemoryConfig;
  /** New memory options (preferred) */
  memory?: AgentMemoryOption;
  /** Unique ID for this generation run */
  runId?: string;
  /** Callback fired when streaming completes */
  onFinish?: OUTPUT extends undefined ? StreamTextOnFinishCallback<any> : StreamObjectOnFinishCallback<OUTPUT>;
  /** Callback fired after each generation step completes */
  onStepFinish?: OUTPUT extends undefined ? StreamTextOnStepFinishCallback<any> : never;
  /** Maximum number of steps allowed for generation */
  maxSteps?: number;
  /** Schema for structured output */
  output?: OutputType | OUTPUT;
  /** Temperature parameter for controlling randomness */
  temperature?: number;
  /** Controls how tools are selected during generation */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  /** Experimental schema for structured output */
  experimental_output?: EXPERIMENTAL_OUTPUT;
  /** Telemetry settings */
  telemetry?: TelemetrySettings;
  /** RuntimeContext for dependency injection */
  runtimeContext?: RuntimeContext;
  /**
   * Whether to save messages incrementally on step finish
   * @default false
   */
  savePerStep?: boolean;
  /** Input processors to use for this generation call (overrides agent's default) */
  inputProcessors?: InputProcessor[];
  /** AI tracing context for span hierarchy and metadata */
  tracingContext?: TracingContext;
  /** AI tracing options for starting new traces */
  tracingOptions?: TracingOptions;
  /** Scorers to use for this generation */
  scorers?: MastraScorers | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>;
} & (
  | {
      /**
       * @deprecated Use the `memory` property instead for all memory-related options.
       */
      resourceId?: undefined;
      /**
       * @deprecated Use the `memory` property instead for all memory-related options.
       */
      threadId?: undefined;
    }
  | {
      /**
       * @deprecated Use the `memory` property instead for all memory-related options.
       */
      resourceId: string;
      /**
       * @deprecated Use the `memory` property instead for all memory-related options.
       */
      threadId: string;
    }
) &
  (OUTPUT extends undefined ? DefaultLLMStreamOptions : DefaultLLMStreamObjectOptions);

export type AgentModelManagerConfig = ModelManagerModelConfig & { enabled: boolean };
