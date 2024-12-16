import { z } from 'zod';

import { Agent } from '../agent';
import { MastraEngine } from '../engine';
import { LLM } from '../llm';
import { ModelConfig } from '../llm/types';
import { MastraMemory } from '../memory';
import { SyncAction } from '../sync';
import { MastraVector } from '../vector';

export interface IExecutionContext<TPayload, TContext> {
  context: TPayload & { machineContext?: TContext };
  runId?: string;
  engine?: MastraEngine;
  agents?: Record<string, Agent>;
  vectors?: Record<string, MastraVector>;
  memory?: MastraMemory;
  syncs?: Record<string, SyncAction<any, any, any, any>>;
  llm?: (model: ModelConfig) => LLM;
}

export interface IAction<
  TId extends string,
  TSchemaIn extends z.ZodSchema,
  TSchemaOut extends z.ZodSchema,
  TContext extends IExecutionContext<z.infer<TSchemaIn>, any>,
> {
  id: TId;
  description?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  payload?: Partial<z.infer<TSchemaIn>>;
  execute: (context: TContext) => Promise<z.infer<TSchemaOut>>;
  [key: string]: any;
}
