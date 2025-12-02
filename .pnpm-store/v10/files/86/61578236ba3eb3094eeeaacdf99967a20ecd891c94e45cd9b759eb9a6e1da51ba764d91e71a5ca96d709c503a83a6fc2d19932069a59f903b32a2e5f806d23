import {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
  getFunctionName,
} from "../../server/api.js";
import { parseArgs } from "../../common/index.js";
import { Value } from "../../values/index.js";
import { createHybridErrorStacktrace, forwardData } from "../logging.js";
import { FunctionResult } from "./function_result.js";
import { OptimisticLocalStore } from "./optimistic_updates.js";
import { RequestId } from "./protocol.js";
import {
  canonicalizeUdfPath,
  QueryToken,
  serializePathAndArgs,
} from "./udf_path_utils.js";
import { ConvexError } from "../../values/errors.js";

/**
 * An optimistic update function that has been curried over its arguments.
 */
type WrappedOptimisticUpdate = (locaQueryStore: OptimisticLocalStore) => void;

/**
 * The implementation of `OptimisticLocalStore`.
 *
 * This class provides the interface for optimistic updates to modify query results.
 */
class OptimisticLocalStoreImpl implements OptimisticLocalStore {
  // A references of the query results in OptimisticQueryResults
  private readonly queryResults: QueryResultsMap;

  // All of the queries modified by this class
  readonly modifiedQueries: QueryToken[];

  constructor(queryResults: QueryResultsMap) {
    this.queryResults = queryResults;
    this.modifiedQueries = [];
  }

  getQuery<Query extends FunctionReference<"query">>(
    query: Query,
    ...args: OptionalRestArgs<Query>
  ): undefined | FunctionReturnType<Query> {
    const queryArgs = parseArgs(args[0]);
    const name = getFunctionName(query);
    const queryResult = this.queryResults.get(
      serializePathAndArgs(name, queryArgs),
    );
    if (queryResult === undefined) {
      return undefined;
    }
    return OptimisticLocalStoreImpl.queryValue(queryResult.result);
  }

  getAllQueries<Query extends FunctionReference<"query">>(
    query: Query,
  ): {
    args: FunctionArgs<Query>;
    value: undefined | FunctionReturnType<Query>;
  }[] {
    const queriesWithName: {
      args: FunctionArgs<Query>;
      value: undefined | FunctionReturnType<Query>;
    }[] = [];
    const name = getFunctionName(query);
    for (const queryResult of this.queryResults.values()) {
      if (queryResult.udfPath === canonicalizeUdfPath(name)) {
        queriesWithName.push({
          args: queryResult.args as FunctionArgs<Query>,
          value: OptimisticLocalStoreImpl.queryValue(queryResult.result),
        });
      }
    }
    return queriesWithName;
  }

  setQuery<QueryReference extends FunctionReference<"query">>(
    queryReference: QueryReference,
    args: FunctionArgs<QueryReference>,
    value: undefined | FunctionReturnType<QueryReference>,
  ): void {
    const queryArgs = parseArgs(args);
    const name = getFunctionName(queryReference);
    const queryToken = serializePathAndArgs(name, queryArgs);

    let result: FunctionResult | undefined;
    if (value === undefined) {
      result = undefined;
    } else {
      result = {
        success: true,
        value,
        // It's an optimistic update, so there are no function logs to show.
        logLines: [],
      };
    }
    const query: Query = {
      udfPath: name,
      args: queryArgs,
      result,
    };
    this.queryResults.set(queryToken, query);
    this.modifiedQueries.push(queryToken);
  }

  private static queryValue(
    result: FunctionResult | undefined,
  ): Value | undefined {
    if (result === undefined) {
      return undefined;
    } else if (result.success) {
      return result.value;
    } else {
      // If the query is an error state, just return `undefined` as though
      // it's loading. Optimistic updates should already handle `undefined` well
      // and there isn't a need to break the whole update because it tried
      // to load a single query that errored.
      return undefined;
    }
  }
}

type OptimisticUpdateAndId = {
  update: WrappedOptimisticUpdate;
  mutationId: RequestId;
};

type Query = {
  // undefined means the query was set to be loading (undefined) in an optimistic update.
  // Note that we can also have queries not present in the QueryResultMap
  // at all because they are still loading from the server and have no optimistic update
  // setting an optimistic value in advance.
  result: FunctionResult | undefined;
  udfPath: string;
  args: Record<string, Value>;
};
export type QueryResultsMap = Map<QueryToken, Query>;

type ChangedQueries = QueryToken[];

/**
 * A view of all of our query results with optimistic updates applied on top.
 */
export class OptimisticQueryResults {
  private queryResults: QueryResultsMap;
  private optimisticUpdates: OptimisticUpdateAndId[];

  constructor() {
    this.queryResults = new Map();
    this.optimisticUpdates = [];
  }

  /**
   * Apply all optimistic updates on top of server query results
   */
  ingestQueryResultsFromServer(
    serverQueryResults: QueryResultsMap,
    optimisticUpdatesToDrop: Set<RequestId>,
  ): ChangedQueries {
    this.optimisticUpdates = this.optimisticUpdates.filter((updateAndId) => {
      return !optimisticUpdatesToDrop.has(updateAndId.mutationId);
    });

    const oldQueryResults = this.queryResults;
    this.queryResults = new Map(serverQueryResults);
    const localStore = new OptimisticLocalStoreImpl(this.queryResults);
    for (const updateAndId of this.optimisticUpdates) {
      updateAndId.update(localStore);
    }

    // To find the changed queries, just do a shallow comparison
    // TODO(CX-733): Change this so we avoid unnecessary rerenders
    const changedQueries: ChangedQueries = [];
    for (const [queryToken, query] of this.queryResults) {
      const oldQuery = oldQueryResults.get(queryToken);
      if (oldQuery === undefined || oldQuery.result !== query.result) {
        changedQueries.push(queryToken);
      }
    }

    return changedQueries;
  }

  applyOptimisticUpdate(
    update: WrappedOptimisticUpdate,
    mutationId: RequestId,
  ): ChangedQueries {
    // Apply the update to our store
    this.optimisticUpdates.push({
      update,
      mutationId,
    });
    const localStore = new OptimisticLocalStoreImpl(this.queryResults);
    update(localStore);

    // Notify about any query results that changed
    // TODO(CX-733): Change this so we avoid unnecessary rerenders
    return localStore.modifiedQueries;
  }

  /**
   * @internal
   */
  rawQueryResult(queryToken: QueryToken): Query | undefined {
    return this.queryResults.get(queryToken);
  }

  queryResult(queryToken: QueryToken): Value | undefined {
    const query = this.queryResults.get(queryToken);
    if (query === undefined) {
      return undefined;
    }
    const result = query.result;
    if (result === undefined) {
      return undefined;
    } else if (result.success) {
      return result.value;
    } else {
      if (result.errorData !== undefined) {
        throw forwardData(
          result,
          new ConvexError(
            createHybridErrorStacktrace("query", query.udfPath, result),
          ),
        );
      }
      throw new Error(
        createHybridErrorStacktrace("query", query.udfPath, result),
      );
    }
  }

  hasQueryResult(queryToken: QueryToken): boolean {
    return this.queryResults.get(queryToken) !== undefined;
  }

  /**
   * @internal
   */
  queryLogs(queryToken: QueryToken): string[] | undefined {
    const query = this.queryResults.get(queryToken);
    return query?.result?.logLines;
  }
}
