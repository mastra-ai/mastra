import type { LanguageModelV1, TelemetrySettings } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';

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

export type AgentGenerateOptions<
  Z extends ZodSchema | JSONSchema7 | undefined = undefined,
  TSchemaDeps extends ZodSchema | undefined = undefined,
> = {
  instructions?: string;
  toolsets?: ToolsetsInput<TSchemaDeps>;
  context?: CoreMessage[];
  memoryOptions?: MemoryConfig;
  runId?: string;
  onStepFinish?: (step: string) => void;
  maxSteps?: number;
  output?: OutputType | Z;
  experimental_output?: Z;
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  telemetry?: TelemetrySettings;
  dependencies?: DependenciesType<TSchemaDeps>;
} & ({ resourceId?: undefined; threadId?: undefined } | { resourceId: string; threadId: string }) &
  (Z extends undefined ? DefaultLLMTextOptions : DefaultLLMTextObjectOptions);

export type AgentStreamOptions<
  Z extends ZodSchema | JSONSchema7 | undefined = undefined,
  TSchemaDeps extends ZodSchema | undefined = undefined,
> = {
  instructions?: string;
  toolsets?: ToolsetsInput<TSchemaDeps>;
  context?: CoreMessage[];
  memoryOptions?: MemoryConfig;
  runId?: string;
  onFinish?: (result: string) => unknown;
  onStepFinish?: (step: string) => unknown;
  maxSteps?: number;
  output?: OutputType | Z;
  temperature?: number;
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  experimental_output?: Z;
  telemetry?: TelemetrySettings;
  dependencies?: DependenciesType<TSchemaDeps>;
} & ({ resourceId?: undefined; threadId?: undefined } | { resourceId: string; threadId: string }) &
  (Z extends undefined ? DefaultLLMStreamOptions : DefaultLLMStreamObjectOptions);
