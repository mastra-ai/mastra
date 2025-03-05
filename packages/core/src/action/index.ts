import type { z } from 'zod';

import type { Agent } from '../agent';
import type { Logger } from '../logger';
import type { MastraMemory } from '../memory';
import type { MastraStorage } from '../storage';
import type { Telemetry } from '../telemetry';
import type { MastraTTS } from '../tts';
import type { MastraVector } from '../vector';
import type { WorkflowContext } from '../workflows';

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
  context: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> & TContext : TContext;
  runId?: string;
  mastra?: MastraPrimitives;
  threadId?: string;
  resourceId?: string;
  suspend: () => Promise<void>;
}
export interface IAction<
  TId extends string,
  TSchemaIn extends z.ZodSchema | undefined,
  TSchemaOut extends z.ZodSchema | undefined,
  TContext extends IExecutionContext<TSchemaIn>,
  TOptions extends unknown = unknown,
> {
  id: TId;
  description?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  mastra?: MastraPrimitives;
  payload?: TSchemaIn extends z.ZodSchema ? Partial<z.infer<TSchemaIn>> : unknown;
  execute?: (
    context: TContext,
    options?: TOptions,
  ) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
  [key: string]: any;
}
