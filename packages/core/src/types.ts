import type { Mastra } from './mastra';
import type { RuntimeContext } from './runtime-context';

export type DynamicArgument<T> =
  | T
  | (({ runtimeContext, mastra }: { runtimeContext: RuntimeContext; mastra?: Mastra }) => Promise<T> | T);

export type NonEmpty<T extends string> = T extends '' ? never : T;

export interface IdGeneratorContext {
  type: 'agent' | 'workflow' | 'memory' | 'network' | 'internal' | 'unknown';
  agentId?: string;
  agentName?: string;
  workflowId?: string;
  workflowName?: string;
  threadId?: string;
  resourceId?: string;
  stepId?: string;
  runId?: string;
  [key: string]: any;
}

export type MastraIdGenerator = (context?: IdGeneratorContext) => NonEmpty<string>;
