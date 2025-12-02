import { Value } from "../../values/index.js";
import {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
} from "../../server/api.js";

/**
 * A view of the query results currently in the Convex client for use within
 * optimistic updates.
 *
 * @public
 */
export interface OptimisticLocalStore {
  /**
   * Retrieve the result of a query from the client.
   *
   * Important: Query results should be treated as immutable!
   * Always make new copies of structures within query results to avoid
   * corrupting data within the client.
   *
   * @param query - A {@link FunctionReference} for the query to get.
   * @param args - The arguments object for this query.
   * @returns The query result or `undefined` if the query is not currently
   * in the client.
   */
  getQuery<Query extends FunctionReference<"query">>(
    query: Query,
    ...args: OptionalRestArgs<Query>
  ): undefined | FunctionReturnType<Query>;

  /**
   * Retrieve the results and arguments of all queries with a given name.
   *
   * This is useful for complex optimistic updates that need to inspect and
   * update many query results (for example updating a paginated list).
   *
   * Important: Query results should be treated as immutable!
   * Always make new copies of structures within query results to avoid
   * corrupting data within the client.
   *
   * @param query - A {@link FunctionReference} for the query to get.
   * @returns An array of objects, one for each query of the given name.
   * Each object includes:
   *   - `args` - The arguments object for the query.
   *   - `value` The query result or `undefined` if the query is loading.
   */
  getAllQueries<Query extends FunctionReference<"query">>(
    query: Query,
  ): {
    args: FunctionArgs<Query>;
    value: undefined | FunctionReturnType<Query>;
  }[];

  /**
   * Optimistically update the result of a query.
   *
   * This can either be a new value (perhaps derived from the old value from
   * {@link OptimisticLocalStore.getQuery}) or `undefined` to remove the query.
   * Removing a query is useful to create loading states while Convex recomputes
   * the query results.
   *
   * @param query - A {@link FunctionReference} for the query to set.
   * @param args - The arguments object for this query.
   * @param value - The new value to set the query to or `undefined` to remove
   * it from the client.
   */
  setQuery<Query extends FunctionReference<"query">>(
    query: Query,
    args: FunctionArgs<Query>,
    value: undefined | FunctionReturnType<Query>,
  ): void;
}
/**
 * A temporary, local update to query results within this client.
 *
 * This update will always be executed when a mutation is synced to the Convex
 * server and rolled back when the mutation completes.
 *
 * Note that optimistic updates can be called multiple times! If the client
 * loads new data while the mutation is in progress, the update will be replayed
 * again.
 *
 * @param localQueryStore - An interface to read and edit local query results.
 * @param args - The arguments to the mutation.
 *
 * @public
 */
export type OptimisticUpdate<Args extends Record<string, Value>> = (
  localQueryStore: OptimisticLocalStore,
  args: Args,
) => void;
