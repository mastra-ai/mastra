import type { Agent } from '../agent';
import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory';
import type { MastraCompositeStore } from '../storage';
import type { SchemaWithValidation } from '../stream';
import type { MastraTTS } from '../tts';
import type { MastraVector } from '../vector';

export type MastraPrimitives = {
  logger?: IMastraLogger;
  storage?: MastraCompositeStore;
  agents?: Record<string, Agent>;
  tts?: Record<string, MastraTTS>;
  vectors?: Record<string, MastraVector>;
  memory?: MastraMemory;
};

export type MastraUnion = Mastra & MastraPrimitives;

export interface IExecutionContext<TInput> {
  context: TInput;
  runId?: string;
  threadId?: string;
  resourceId?: string;
  memory?: MastraMemory;
}

export interface IAction<
  TId extends string,
  TInput,
  TOutput,
  TContext extends IExecutionContext<TInput>,
  TOptions = unknown,
> {
  id: TId;
  description?: string;
  inputSchema?: SchemaWithValidation<TInput>;
  outputSchema?: SchemaWithValidation<TOutput>;
  // execute must remain optional because ITools extends IAction and tools may need execute to be optional
  // when forwarding tool calls to the client or to a queue instead of executing them in the same process
  execute?: (context: TContext, options?: TOptions) => Promise<TOutput>;
}
