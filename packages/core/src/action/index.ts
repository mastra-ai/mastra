import { z } from 'zod';

import { Agent } from '../agent';
import { Logger } from '../logger';
import { MastraMemory } from '../memory';
import { MastraStorage } from '../storage';
import { Telemetry } from '../telemetry';
import { MastraTTS } from '../tts';
import { MastraVector } from '../vector';
import { type WorkflowContext } from '../workflows';

export type MastraPrimitives = {
  logger?: Logger;
  telemetry?: Telemetry;
  storage?: MastraStorage;
  agents?: Record<string, Agent>;
  tts?: Record<string, MastraTTS>;
  vectors?: Record<string, MastraVector>;
  memory?: MastraMemory;
};
export interface IExecutionContext<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TContext extends WorkflowContext = WorkflowContext,
> {
  context: TSchemaIn extends z.ZodSchema
    ? z.infer<TSchemaIn> & TContext
    : TContext;
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
