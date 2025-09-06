import type { DeepPartial } from 'ai';
import type { Mastra } from './mastra';
import type { RuntimeContext } from './runtime-context';

export type DynamicArgument<T> =
  | T
  | (({ runtimeContext, mastra }: { runtimeContext: RuntimeContext; mastra?: Mastra }) => Promise<T> | T);

/**
 * Recursively makes all properties on T optional
 * except the ones specified, which become required
 */
export type RequireOnly<T, K extends keyof T> = DeepPartial<T> & Required<Pick<T, K>>;

/**
 * Provides clearer type hints for the passed type
 */
export type Resolve<T> = T extends Function ? T : { [K in keyof T]: T[K] };

export type NonEmpty<T extends string> = T extends '' ? never : T;

export type MastraIdGenerator = () => NonEmpty<string>;
