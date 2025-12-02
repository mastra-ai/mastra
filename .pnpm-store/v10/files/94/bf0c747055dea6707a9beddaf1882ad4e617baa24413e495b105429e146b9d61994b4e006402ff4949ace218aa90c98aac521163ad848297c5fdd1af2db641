import { Value } from "../../values/index.js";
import { FunctionResult } from "./function_result.js";
import { OptimisticLocalStore } from "./optimistic_updates.js";
import { RequestId } from "./protocol.js";
import { QueryToken } from "./udf_path_utils.js";
/**
 * An optimistic update function that has been curried over its arguments.
 */
type WrappedOptimisticUpdate = (locaQueryStore: OptimisticLocalStore) => void;
type Query = {
    result: FunctionResult | undefined;
    udfPath: string;
    args: Record<string, Value>;
};
export type QueryResultsMap = Map<QueryToken, Query>;
type ChangedQueries = QueryToken[];
/**
 * A view of all of our query results with optimistic updates applied on top.
 */
export declare class OptimisticQueryResults {
    private queryResults;
    private optimisticUpdates;
    constructor();
    /**
     * Apply all optimistic updates on top of server query results
     */
    ingestQueryResultsFromServer(serverQueryResults: QueryResultsMap, optimisticUpdatesToDrop: Set<RequestId>): ChangedQueries;
    applyOptimisticUpdate(update: WrappedOptimisticUpdate, mutationId: RequestId): ChangedQueries;
    queryResult(queryToken: QueryToken): Value | undefined;
    hasQueryResult(queryToken: QueryToken): boolean;
}
export {};
//# sourceMappingURL=optimistic_updates_impl.d.ts.map