import type { z } from 'zod';

import type { Agent } from '../agent';
import type { Logger } from '../logger';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory';
import type { MastraStorage } from '../storage';
import type { Telemetry } from '../telemetry';
import type { MastraTTS } from '../tts';
import type { InferZodType } from '../utils';
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

export type MastraUnion = {
  [K in keyof Mastra]: Mastra[K];
} & MastraPrimitives;

export interface IExecutionContext<TSchemaIn extends z.ZodSchema | undefined = undefined> {
  context: InferZodType<TSchemaIn, {}>;
  runId?: string;
  threadId?: string;
  resourceId?: string;
}

export interface IAction<
  TId extends string,
  TSchemaIn extends z.ZodSchema | undefined,
  TSchemaOut extends z.ZodSchema | undefined,
  TContext extends IExecutionContext<TSchemaIn>,
  TExtraArgs extends unknown[] = [],
> {
  id: TId;
  description?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  // execute must remain optional because ITools extends IAction and tools may need execute to be optional
  // when forwarding tool calls to the client or to a queue instead of executing them in the same process
  execute?: (context: TContext, ...extraArgs: TExtraArgs) => Promise<InferZodType<TSchemaOut, unknown>>;
}
