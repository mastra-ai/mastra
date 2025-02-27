import type { LanguageModelV1, TelemetrySettings } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';

import type { MastraPrimitives } from '../action';
import type { Metric } from '../eval';
import type { CoreMessage, OutputType } from '../llm';
import type { MastraMemory } from '../memory/memory';
import type { MemoryConfig } from '../memory/types';
import type { ToolAction } from '../tools';
import type { CompositeVoice } from '../voice';

export type { Message as AiMessageType } from 'ai';

export type ToolsetsInput = Record<string, Record<string, ToolAction<any, any, any, any>>>;

export type ToolsInput = Record<string, ToolAction<any, any, any, any>>;

export interface AgentConfig<
  TTools extends Record<string, ToolAction<any, any, any, any>> = Record<string, ToolAction<any, any, any, any>>,
  TMetrics extends Record<string, Metric> = Record<string, Metric>,
> {
  name: string;
  instructions: string;
  model: LanguageModelV1;
  tools?: TTools;
  mastra?: MastraPrimitives;
  /** @deprecated This property is deprecated. Use evals instead to add evaluation metrics. */
  metrics?: TMetrics;
  evals?: TMetrics;
  memory?: MastraMemory;
  voice?: CompositeVoice;
}

export type AgentGenerateOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  toolsets?: ToolsetsInput;
  context?: CoreMessage[];
  memoryOptions?: MemoryConfig;
  runId?: string;
  onStepFinish?: (step: string) => void;
  maxSteps?: number;
  output?: OutputType | Z;
  temperature?: number;
  toolChoice?: 'auto' | 'required';
  experimental_output?: Z;
  telemetry?: TelemetrySettings;
} & ({ resourceId?: undefined; threadId?: undefined } | { resourceId: string; threadId: string });

export type AgentStreamOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  toolsets?: ToolsetsInput;
  context?: CoreMessage[];
  memoryOptions?: MemoryConfig;
  runId?: string;
  onFinish?: (result: string) => unknown;
  onStepFinish?: (step: string) => unknown;
  maxSteps?: number;
  output?: OutputType | Z;
  temperature?: number;
  toolChoice?: 'auto' | 'required';
  experimental_output?: Z;
  telemetry?: TelemetrySettings;
} & ({ resourceId?: undefined; threadId?: undefined } | { resourceId: string; threadId: string });
