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
import type { ToolActionWithVars, VercelTool } from '../tools';
import type { VariablesType } from '../utils';
import type { CompositeVoice } from '../voice';

export type { Message as AiMessageType } from 'ai';

export type StringRecord<T> = Record<string, T>;

export type Tools<TSchemaVariables extends ZodSchema | undefined> = ToolActionWithVars<TSchemaVariables> | VercelTool;

export type ToolsInput<TSchemaVariables extends ZodSchema | undefined> = StringRecord<Tools<TSchemaVariables>>;

export type ToolsetsInput<TSchemaVariables extends ZodSchema | undefined> = StringRecord<ToolsInput<TSchemaVariables>>;

export type MastraLanguageModel = LanguageModelV1;

export interface AgentConfig<
  TAgentId extends string = string,
  TSchemaVariables extends ZodSchema | undefined = undefined,
  TTools extends ToolsInput<TSchemaVariables> = ToolsInput<TSchemaVariables>,
  TMetrics extends Record<string, Metric> = Record<string, Metric>,
> {
  name: TAgentId;
  instructions: string;
  model: MastraLanguageModel;
  variablesSchema?: TSchemaVariables;
  defaultGenerateOptions?: AgentGenerateOptions;
  defaultStreamOptions?: AgentStreamOptions;
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
 * @template TSchemaVariables - The schema type for runtime variables (Zod schema)
 */
export type AgentGenerateOptions<
  Z extends ZodSchema | JSONSchema7 | undefined = undefined,
  TSchemaVariables extends ZodSchema | undefined = undefined,
> = {
  /** Optional instructions to override the agent's default instructions */
  instructions?: string;
  /** Additional tool sets that can be used for this generation */
  toolsets?: ToolsetsInput<TSchemaVariables>;
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
  /** Dynamic variables passed at runtime for use within tool execution context */
  variables?: VariablesType<TSchemaVariables>;
} & ({ resourceId?: undefined; threadId?: undefined } | { resourceId: string; threadId: string }) &
  (Z extends undefined ? DefaultLLMTextOptions : DefaultLLMTextObjectOptions);

/**
 * Options for streaming responses with an agent
 * @template Z - The schema type for structured output (Zod schema or JSON schema)
 * @template TSchemaVariables - The schema type for runtime variables (Zod schema)
 */
export type AgentStreamOptions<
  Z extends ZodSchema | JSONSchema7 | undefined = undefined,
  TSchemaVariables extends ZodSchema | undefined = undefined,
> = {
  /** Optional instructions to override the agent's default instructions */
  instructions?: string;
  /** Additional tool sets that can be used for this generation */
  toolsets?: ToolsetsInput<TSchemaVariables>;
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
  /** Dynamic variables passed at runtime for use within tool execution context */
  variables?: VariablesType<TSchemaVariables>;
} & ({ resourceId?: undefined; threadId?: undefined } | { resourceId: string; threadId: string }) &
  (Z extends undefined ? DefaultLLMStreamOptions : DefaultLLMStreamObjectOptions);
