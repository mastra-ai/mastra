import type { Agent } from '../agent';
import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory';
import type { MastraStorage } from '../storage';
import type { MastraTTS } from '../tts';
import type { MastraVector } from '../vector';

export type MastraPrimitives = {
  logger?: IMastraLogger;
  storage?: MastraStorage;
  agents?: Record<string, Agent>;
  tts?: Record<string, MastraTTS>;
  vectors?: Record<string, MastraVector>;
  memory?: MastraMemory;
};

export type MastraUnion = {
  [K in keyof Mastra]: Mastra[K];
} & MastraPrimitives;

export interface IExecutionContext<TSchemaIn = {}> {
  context: TSchemaIn;
  runId?: string;
  threadId?: string;
  resourceId?: string;
  memory?: MastraMemory;
}

export interface IAction<
  TId extends string,
  TSchemaIn,
  TSchemaOut,
  TContext extends IExecutionContext<TSchemaIn>,
  TOptions = unknown,
> {
  id: TId;
  description?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  // execute must remain optional because ITools extends IAction and tools may need execute to be optional
  // when forwarding tool calls to the client or to a queue instead of executing them in the same process
  execute?: (context: TContext, options?: TOptions) => Promise<TSchemaOut>;
}
