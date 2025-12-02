/**
 * Query options are a potential new API for a variety of functions, but in particular a new overload of the React hook for queries.
 *
 * Inspired by https://tanstack.com/query/v5/docs/framework/react/guides/query-options
 */
import type { FunctionArgs, FunctionReference } from "../server/api.js";

// TODO if this type can encompass all use cases we can add not requiring args for queries
// that don't take arguments. Goal would be that queryOptions allows leaving out args,
// but queryOptions returns an object that always contains args. Helpers, "middleware,"
// anything that intercepts these arguments
/**
 * Query options.
 */
export type ConvexQueryOptions<Query extends FunctionReference<"query">> = {
  query: Query;
  args: FunctionArgs<Query>;
  extendSubscriptionFor?: number;
};

// This helper helps more once we have more inference happening.
export function convexQueryOptions<Query extends FunctionReference<"query">>(
  options: ConvexQueryOptions<Query>,
): ConvexQueryOptions<Query> {
  return options;
}
