import type { GenerateTextOnStepFinishCallback, LanguageModelV1, TelemetrySettings } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';
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
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import type { MemoryConfig, StorageThreadType } from '../memory/types';
import type { RuntimeContext } from '../runtime-context';
import type { MastraScorers } from '../scores';
import type { ToolAction, VercelTool } from '../tools';
import type { DynamicArgument } from '../types';
import type { CompositeVoice } from '../voice';
import type { Workflow } from '../workflows';
import type { AgentVNextStreamOptions } from './agent.types';
import type { InputProcessor } from './input-processor';

export type { MastraMessageV2, MastraMessageContentV2, UIMessageWithMetadata, MessageList } from './message-list/index';
export type { Message as AiMessageType } from 'ai';

export type ToolsInput = Record<string, ToolAction<any, any, any> | VercelTool>;

export type ToolsetsInput = Record<string, ToolsInput>;

export type MastraLanguageModel = LanguageModelV1;

export interface AgentConfig<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TMetrics extends Record<string, Metric> = Record<string, Metric>,
> {
  id?: TAgentId;
  name: TAgentId;
  description?: string;
  instructions: DynamicArgument<string>;
  model: DynamicArgument<MastraLanguageModel>;
  tools?: DynamicArgument<TTools>;
  workflows?: DynamicArgument<Record<string, Workflow>>;
  defaultGenerateOptions?: DynamicArgument<AgentGenerateOptions>;
  defaultStreamOptions?: DynamicArgument<AgentStreamOptions>;
  defaultVNextStreamOptions?: DynamicArgument<AgentVNextStreamOptions>;
  mastra?: Mastra;
  scorers?: DynamicArgument<MastraScorers>;
  evals?: TMetrics;
  memory?: DynamicArgument<MastraMemory>;
  voice?: CompositeVoice;
  inputProcessors?: DynamicArgument<InputProcessor[]>;
}

export type AgentMemoryOption = {
  thread: string | (Partial<StorageThreadType> & { id: string });
  resource: string;
  options?: MemoryConfig;
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
  /** Controls how tools are selected during generation */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  /** Telemetry settings */
  telemetry?: TelemetrySettings;
  /** RuntimeContext for dependency injection */
  runtimeContext?: RuntimeContext;
  /**
   * Whether to save messages incrementally on step finish
   * @default false
   */
  savePerStep?: boolean;
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
