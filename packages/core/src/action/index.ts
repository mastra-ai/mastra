import type { z } from 'zod';

import type { Agent } from '../agent';
import type { Logger } from '../logger';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory';
import type { MastraStorage } from '../storage';
import type { Telemetry } from '../telemetry';
import type { MastraTTS } from '../tts';
import type { MastraVector } from '../vector';

export type MastraPrimitives = {
  logger?: Logger;
  telemetry?: Telemetry;
  storage?: MastraStorage;
  agents?: Record<string, Agent>;
  tts?: Record<string, MastraTTS>;
  vectors?: Record<string, MastraVector>;
  memory?: MastraMemory;
};

type MastraUnion = Mastra | MastraPrimitives;

export interface IExecutionContext<TSchemaIn extends z.ZodSchema | undefined = undefined> {
  context: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : {};
  runId?: string;
  mastra?: MastraUnion;
  threadId?: string;
  resourceId?: string;
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
  mastra?: Mastra;
  payload?: TSchemaIn extends z.ZodSchema ? Partial<z.infer<TSchemaIn>> : unknown;
  execute: (
    context: TContext,
    options?: TOptions,
  ) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
}
