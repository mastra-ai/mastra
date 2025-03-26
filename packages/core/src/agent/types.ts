import type {
  GenerateTextOnStepFinishCallback,
  LanguageModelV1,
  StreamObjectOnFinishCallback,
  StreamTextOnFinishCallback,
  StreamTextOnStepFinishCallback,
  TelemetrySettings,
} from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodSchema } from 'zod';

import type { Metric } from '../eval';
import type {
  CoreMessage,
  DefaultLLMStreamObjectOptions,
  DefaultLLMStreamOptions,
  DefaultLLMTextObjectOptions,
  DefaultLLMTextOptions,
  OutputType,
} from '../llm';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import type { MemoryConfig } from '../memory/types';
import type { ToolActionWithDeps, VercelTool } from '../tools';
import type { DependenciesType } from '../utils';
import type { CompositeVoice } from '../voice';

export type { Message as AiMessageType } from 'ai';

export type Tools<TSchemaDeps extends ZodSchema | undefined> = ToolActionWithDeps<TSchemaDeps> | VercelTool;
export type ToolsInput<TSchemaDeps extends ZodSchema | undefined> = Record<string, Tools<TSchemaDeps>>;
export type ToolsetsInput<TSchemaDeps extends ZodSchema | undefined> = Record<string, ToolsInput<TSchemaDeps>>;
export type MastraLanguageModel = LanguageModelV1;

export type InstructionsBuilder<TSchemaDeps extends ZodSchema | undefined> = (context: {
  dependencies: DependenciesType<TSchemaDeps>;
}) => Promise<string> | string;

export interface AgentConfig<
  TSchemaDeps extends ZodSchema | undefined = undefined,
  TTools extends ToolsInput<TSchemaDeps> = ToolsInput<TSchemaDeps>,
  TMetrics extends Record<string, Metric> = Record<string, Metric>,
> {
  name: string;
  instructions: string | InstructionsBuilder<TSchemaDeps>;
  model: MastraLanguageModel;
  dependenciesSchema?: TSchemaDeps;
  tools?: TTools;
  mastra?: Mastra;
  /** @deprecated This property is deprecated. Use evals instead to add evaluation metrics. */
  metrics?: TMetrics;
  evals?: TMetrics;
  memory?: MastraMemory;
  voice?: CompositeVoice;
}

/**
 * Options for generating responses with an agent
 * @template Z - The schema type for structured output (Zod schema or JSON schema)
 * @template TSchemaDeps - The schema type for runtime dependencies (Zod schema)
 */
export type AgentGenerateOptions<
  Z extends ZodSchema | JSONSchema7 | undefined = undefined,
  TSchemaDeps extends ZodSchema | undefined = undefined,
> = {
  /** Optional instructions to override the agent's default instructions */
  instructions?: string;
  /** Additional tool sets that can be used for this generation */
  toolsets?: ToolsetsInput<TSchemaDeps>;
  /** Additional context messages to include */
  context?: CoreMessage[];
  /** Memory configuration options */
  memoryOptions?: MemoryConfig;
  /** Unique ID for this generation run */
  runId?: string;
  /** Callback fired after each generation step completes */
  onStepFinish?: Z extends undefined ? GenerateTextOnStepFinishCallback<any> : never;
  /** Maximum number of steps allowed for generation */
  maxSteps?: number;
  /** Schema for structured output, does not work with tools, use experimental_output instead */
  output?: OutputType | Z;
  /** Schema for structured output generation alongside tool calls */
  experimental_output?: Z;
  /** Controls how tools are selected during generation */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  /** Telemetry settings */
  telemetry?: TelemetrySettings;
  /** Dependencies to use in tool execution or instruction builder */
  dependencies?: DependenciesType<TSchemaDeps>;
} & ({ resourceId?: undefined; threadId?: undefined } | { resourceId: string; threadId: string }) &
  (Z extends undefined ? DefaultLLMTextOptions : DefaultLLMTextObjectOptions);

/**
 * Options for streaming responses with an agent
 * @template Z - The schema type for structured output (Zod schema or JSON schema)
 * @template TSchemaDeps - The schema type for runtime dependencies (Zod schema)
 */
export type AgentStreamOptions<
  Z extends ZodSchema | JSONSchema7 | undefined = undefined,
  TSchemaDeps extends ZodSchema | undefined = undefined,
> = {
  /** Optional instructions to override the agent's default instructions */
  instructions?: string;
  /** Additional tool sets that can be used for this generation */
  toolsets?: ToolsetsInput<TSchemaDeps>;
  /** Additional context messages to include */
  context?: CoreMessage[];
  /** Memory configuration options */
  memoryOptions?: MemoryConfig;
  /** Unique ID for this generation run */
  runId?: string;
  /** Callback fired when streaming completes */
  onFinish?: Z extends undefined
    ? StreamTextOnFinishCallback<any>
    : Z extends ZodSchema
      ? StreamObjectOnFinishCallback<z.infer<Z>>
      : StreamObjectOnFinishCallback<any>;
  /** Callback fired after each generation step completes */
  onStepFinish?: Z extends undefined ? StreamTextOnStepFinishCallback<any> : never;
  /** Maximum number of steps allowed for generation */
  maxSteps?: number;
  /** Schema for structured output */
  output?: OutputType | Z;
  /** Temperature parameter for controlling randomness */
  temperature?: number;
  /** Controls how tools are selected during generation */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  /** Experimental schema for structured output */
  experimental_output?: Z;
  /** Telemetry settings */
  telemetry?: TelemetrySettings;
  /** Dependencies to use in tool execution or instruction builder */
  dependencies?: DependenciesType<TSchemaDeps>;
} & ({ resourceId?: undefined; threadId?: undefined } | { resourceId: string; threadId: string }) &
  (Z extends undefined ? DefaultLLMStreamOptions : DefaultLLMStreamObjectOptions);
