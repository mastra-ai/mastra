import { Value } from "../values/index.js";
import { useEffect, useMemo, useState } from "react";
import { useConvex } from "./client.js";
import { CreateWatch, QueriesObserver } from "./queries_observer.js";
import { useSubscription } from "./use_subscription.js";
import { QueryJournal } from "../browser/index.js";
import { FunctionReference } from "../server/api.js";

/**
 * Load a variable number of reactive Convex queries.
 *
 * `useQueries` is similar to {@link useQuery} but it allows
 * loading multiple queries which can be useful for loading a dynamic number
 * of queries without violating the rules of React hooks.
 *
 * This hook accepts an object whose keys are identifiers for each query and the
 * values are objects of `{ query: FunctionReference, args: Record<string, Value> }`. The
 * `query` is a FunctionReference for the Convex query function to load, and the `args` are
 * the arguments to that function.
 *
 * The hook returns an object that maps each identifier to the result of the query,
 * `undefined` if the query is still loading, or an instance of `Error` if the query
 * threw an exception.
 *
 * For example if you loaded a query like:
 * ```typescript
 * const results = useQueries({
 *   messagesInGeneral: {
 *     query: "listMessages",
 *     args: { channel: "#general" }
 *   }
 * });
 * ```
 * then the result would look like:
 * ```typescript
 * {
 *   messagesInGeneral: [{
 *     channel: "#general",
 *     body: "hello"
 *     _id: ...,
 *     _creationTime: ...
 *   }]
 * }
 * ```
 *
 * This React hook contains internal state that will cause a rerender
 * whenever any of the query results change.
 *
 * Throws an error if not used under {@link ConvexProvider}.
 *
 * @param queries - An object mapping identifiers to objects of
 * `{query: string, args: Record<string, Value> }` describing which query
 * functions to fetch.
 * @returns An object with the same keys as the input. The values are the result
 * of the query function, `undefined` if it's still loading, or an `Error` if
 * it threw an exception.
 *
 * @public
 */
export function useQueries(
  queries: RequestForQueries,
): Record<string, any | undefined | Error> {
  const convex = useConvex();
  if (convex === undefined) {
    // Error message includes `useQuery` because this hook is called by `useQuery`
    // more often than it's called directly.
    throw new Error(
      "Could not find Convex client! `useQuery` must be used in the React component " +
        "tree under `ConvexProvider`. Did you forget it? " +
        "See https://docs.convex.dev/quick-start#set-up-convex-in-your-react-app",
    );
  }
  const createWatch = useMemo(() => {
    return (
      query: FunctionReference<"query">,
      args: Record<string, Value>,
      journal?: QueryJournal,
    ) => {
      return convex.watchQuery(query, args, journal ? { journal } : {});
    };
  }, [convex]);
  return useQueriesHelper(queries, createWatch);
}

/**
 * Internal version of `useQueries` that is exported for testing.
 */
export function useQueriesHelper(
  queries: RequestForQueries,
  createWatch: CreateWatch,
): Record<string, any | undefined | Error> {
  const [observer] = useState(() => new QueriesObserver(createWatch));

  if (observer.createWatch !== createWatch) {
    observer.setCreateWatch(createWatch);
  }

  // Unsubscribe from all queries on unmount.
  useEffect(() => () => observer.destroy(), [observer]);

  const subscription = useMemo(
    () => ({
      getCurrentValue: () => {
        return observer.getLocalResults(queries);
      },
      subscribe: (callback: () => void) => {
        observer.setQueries(queries);
        return observer.subscribe(callback);
      },
    }),
    [observer, queries],
  );

  return useSubscription(subscription);
}

/**
 * An object representing a request to load multiple queries.
 *
 * The keys of this object are identifiers and the values are objects containing
 * the query function and the arguments to pass to it.
 *
 * This is used as an argument to {@link useQueries}.
 * @public
 */
export type RequestForQueries = Record<
  string,
  {
    query: FunctionReference<"query">;
    args: Record<string, Value>;
  }
>;
