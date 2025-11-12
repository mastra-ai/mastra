import type { Mastra } from '../mastra';
import type { RequestContext } from '../request-context';

export type DynamicArgument<T> =
  | T
  | (({ requestContext, mastra }: { requestContext: RequestContext; mastra?: Mastra }) => Promise<T> | T);

export type NonEmpty<T extends string> = T extends '' ? never : T;

export type MastraIdGenerator = () => NonEmpty<string>;
