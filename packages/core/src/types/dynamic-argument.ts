import type { Mastra } from '../mastra';
import type { RuntimeContext } from '../runtime-context';

export type DynamicArgument<T> =
  | T
  | (({
      runtimeContext,
      requestContext,
      mastra,
    }: {
      /** Runtime context containing dynamic configuration and state */
      /**
       * @deprecated Use `requestContext` instead. This will be removed in a future version.
       */
      runtimeContext: RuntimeContext;

      /** Request context containing dynamic configuration and state */
      requestContext: RuntimeContext;

      mastra?: Mastra;
    }) => Promise<T> | T);

export type NonEmpty<T extends string> = T extends '' ? never : T;

export type MastraIdGenerator = () => NonEmpty<string>;
