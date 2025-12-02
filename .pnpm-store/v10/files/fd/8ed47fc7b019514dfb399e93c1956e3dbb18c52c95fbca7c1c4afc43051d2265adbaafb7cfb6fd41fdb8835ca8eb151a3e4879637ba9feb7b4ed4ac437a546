/**
 * Query options are a potential new API for a variety of functions, but in particular a new overload of the React hook for queries.
 *
 * Inspired by https://tanstack.com/query/v5/docs/framework/react/guides/query-options
 */
import type { FunctionArgs, FunctionReference } from "../server/api.js";
/**
 * Query options.
 */
export type ConvexQueryOptions<Query extends FunctionReference<"query">> = {
    query: Query;
    args: FunctionArgs<Query>;
    extendSubscriptionFor?: number;
};
export declare function convexQueryOptions<Query extends FunctionReference<"query">>(options: ConvexQueryOptions<Query>): ConvexQueryOptions<Query>;
//# sourceMappingURL=query_options.d.ts.map