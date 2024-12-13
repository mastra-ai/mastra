import { ZodSchema } from 'zod';

import { Agent } from '../agent';
import { MastraEngine } from '../engine';
import { LLM } from '../llm';
import { ModelConfig } from '../llm/types';
import { Run } from '../run/types';

export type CoreTool = {
  description: string;
  parameters: ZodSchema;
  execute: (params: any) => Promise<any>;
};

export type ToolApi<
  IN extends Record<string, unknown> = Record<string, unknown>,
  OUT extends Record<string, unknown> = Record<string, unknown>,
> = {
  schema: ZodSchema<IN>;
  label: string;
  description: string;
  documentation?: string;
  outputSchema?: ZodSchema<OUT>;
  execute: (params: IntegrationApiExcutorParams<IN>) => Promise<OUT>;
  enableCache?: boolean;
};

export type AllTools<TTools> = TTools extends Record<string, ToolApi<any, any>> ? TTools : {};

export interface IntegrationApiExcutorParams<T extends Record<string, unknown>> {
  data: T;
  runId?: Run['runId'];
  llm?: (model: ModelConfig) => LLM;
  engine?: MastraEngine | undefined;
  agents?: Record<string, Agent>;
}
