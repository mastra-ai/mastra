import type { Mastra } from './mastra';
import type { RuntimeContext } from './runtime-context';

export type DynamicArgument<T> =
  | T
  | (({ runtimeContext, mastra }: { runtimeContext: RuntimeContext; mastra?: Mastra }) => Promise<T> | T);
