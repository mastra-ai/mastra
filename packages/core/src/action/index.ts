import { z } from 'zod';

import { Agent } from '../agent';
import { MastraEngine } from '../engine';
import { LLM } from '../llm';
import { ModelConfig } from '../llm/types';
import { Logger } from '../logger';
import { MastraMemory } from '../memory';
import { Telemetry } from '../telemetry';
import { MastraTTS } from '../tts';
import { MastraVector } from '../vector';
import { WorkflowContext } from '../workflows';

export type MastraPrimitives = {
  logger?: Logger;
  telemetry?: Telemetry;
  engine?: MastraEngine;
  agents?: Record<string, Agent>;
  tts?: Record<string, MastraTTS>;
  vectors?: Record<string, MastraVector>;
  memory?: MastraMemory;
  llm?: (model: ModelConfig) => LLM;
};
export interface IExecutionContext<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TContext extends WorkflowContext = WorkflowContext,
> {
  context: TSchemaIn extends z.ZodSchema
    ? z.infer<TSchemaIn> & { machineContext?: TContext }
    : { machineContext?: TContext };
  runId?: string;
  mastra?: MastraPrimitives;
  suspend: () => Promise<void>;
}
export interface IAction<
  TId extends string,
  TSchemaIn extends z.ZodSchema | undefined,
  TSchemaOut extends z.ZodSchema | undefined,
  TContext extends IExecutionContext<TSchemaIn>,
> {
  id: TId;
  description?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  mastra?: MastraPrimitives;
  payload?: TSchemaIn extends z.ZodSchema ? Partial<z.infer<TSchemaIn>> : unknown;
  execute: (context: TContext) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
  [key: string]: any;
}
