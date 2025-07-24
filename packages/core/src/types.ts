import type { RuntimeContext } from './runtime-context';

export type DynamicArgument<T> = T | (({ runtimeContext }: { runtimeContext: RuntimeContext }) => Promise<T> | T);
