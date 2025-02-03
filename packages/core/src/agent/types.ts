import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';

import type { MastraPrimitives } from '../action';
import type { MastraMemory } from '../memory';
import type { Metric } from '../eval';
import type { CoreMessage, ModelConfig, OutputType } from '../llm/types';
import { MemoryConfig } from '../memory';
import type { ToolAction } from '../tools';

export type ToolsetsInput = Record<string, Record<string, ToolAction<any, any, any, any>>>;

export type ToolsInput = Record<string, ToolAction<any, any, any, any>>;

export interface AgentConfig<
  TTools extends Record<string, ToolAction<any, any, any, any>> = Record<string, ToolAction<any, any, any, any>>,
  TMetrics extends Record<string, Metric> = Record<string, Metric>,
> {
  name: string;
  instructions: string;
  model: ModelConfig;
  tools?: TTools;
  mastra?: MastraPrimitives;
  metrics?: TMetrics;
  memory?: MastraMemory;
}

export interface AgentGenerateOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> {
  toolsets?: ToolsetsInput;
  resourceId?: string;
  context?: CoreMessage[];
  threadId?: string;
  memoryOptions?: MemoryConfig;
  runId?: string;
  onStepFinish?: (step: string) => void;
  maxSteps?: number;
  output?: OutputType | Z;
  temperature?: number;
}

export interface AgentStreamOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> {
  toolsets?: ToolsetsInput;
  resourceId?: string;
  context?: CoreMessage[];
  threadId?: string;
  memoryOptions?: MemoryConfig;
  runId?: string;
  onFinish?: (result: string) => Promise<void> | void;
  onStepFinish?: (step: string) => void;
  maxSteps?: number;
  output?: OutputType | Z;
  temperature?: number;
}
