import { BaseConvexClient } from "../browser/index.js";
import type { OptimisticUpdate, QueryToken } from "../browser/index.js";
import React, { useCallback, useContext, useMemo } from "react";
import { convexToJson, Value } from "../values/index.js";
import { QueryJournal } from "../browser/sync/protocol.js";
import {
  AuthTokenFetcher,
  BaseConvexClientOptions,
  ConnectionState,
} from "../browser/sync/client.js";
import type { UserIdentityAttributes } from "../browser/sync/protocol.js";
import { RequestForQueries, useQueries } from "./use_queries.js";
import { useSubscription } from "./use_subscription.js";
import { parseArgs } from "../common/index.js";
import {
  ArgsAndOptions,
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
  getFunctionName,
  makeFunctionReference,
} from "../server/api.js";
import { EmptyObject } from "../server/registration.js";
import {
  instantiateDefaultLogger,
  instantiateNoopLogger,
  Logger,
} from "../browser/logging.js";
import { ConvexQueryOptions } from "../browser/query_options.js";

// When no arguments are passed, extend subscriptions (for APIs that do this by default)
// for this amount after the subscription would otherwise be dropped.
const DEFAULT_EXTEND_SUBSCRIPTION_FOR = 5_000;

if (typeof React === "undefined") {
  throw new Error("Required dependency 'react' not found");
}

// TODO Typedoc doesn't generate documentation for the comment below perhaps
// because it's a callable interface.
/**
 * An interface to execute a Convex mutation function on the server.
 *
 * @public
 */
export interface ReactMutation<Mutation extends FunctionReference<"mutation">> {
  /**
   * Execute the mutation on the server, returning a `Promise` of its return value.
   *
   * @param args - Arguments for the mutation to pass up to the server.
   * @returns The return value of the server-side function call.
   */
  (...args: OptionalRestArgs<Mutation>): Promise<FunctionReturnType<Mutation>>;

  /**
   * Define an optimistic update to apply as part of this mutation.
   *
   * This is a temporary update to the local query results to facilitate a
   * fast, interactive UI. It enables query results to update before a mutation
   * executed on the server.
   *
   * When the mutation is invoked, the optimistic update will be applied.
   *
   * Optimistic updates can also be used to temporarily remove queries from the
   * client and create loading experiences until a mutation completes and the
   * new query results are synced.
   *
   * The update will be automatically rolled back when the mutation is fully
   * completed and queries have been updated.
   *
   * @param optimisticUpdate - The optimistic update to apply.
   * @returns A new `ReactMutation` with the update configured.
   *
   * @public
   */
  withOptimisticUpdate<T extends OptimisticUpdate<FunctionArgs<Mutation>>>(
    optimisticUpdate: T &
      (ReturnType<T> extends Promise<any>
        ? "Optimistic update handlers must be synchronous"
        : {}),
  ): ReactMutation<Mutation>;
}

// Exported only for testing.
export function createMutation(
  mutationReference: FunctionReference<"mutation">,
  client: ConvexReactClient,
  update?: OptimisticUpdate<any>,
): ReactMutation<any> {
  function mutation(args?: Record<string, Value>): Promise<unknown> {
    assertNotAccidentalArgument(args);

    return client.mutation(mutationReference, args, {
      optimisticUpdate: update,
    });
  }
  mutation.withOptimisticUpdate = function withOptimisticUpdate(
    optimisticUpdate: OptimisticUpdate<any>,
  ): ReactMutation<any> {
    if (update !== undefined) {
      throw new Error(
        `Already specified optimistic update for mutation ${getFunctionName(
          mutationReference,
        )}`,
      );
    }
    return createMutation(mutationReference, client, optimisticUpdate);
  };
  return mutation as ReactMutation<any>;
}

/**
 * An interface to execute a Convex action on the server.
 *
 * @public
 */
export interface ReactAction<Action extends FunctionReference<"action">> {
  /**
   * Execute the function on the server, returning a `Promise` of its return value.
   *
   * @param args - Arguments for the function to pass up to the server.
   * @returns The return value of the server-side function call.
   * @public
   */
  (...args: OptionalRestArgs<Action>): Promise<FunctionReturnType<Action>>;
}

function createAction(
  actionReference: FunctionReference<"action">,
  client: ConvexReactClient,
): ReactAction<any> {
  return function (args?: Record<string, Value>): Promise<unknown> {
    return client.action(actionReference, args);
  } as ReactAction<any>;
}

/**
 * A watch on the output of a Convex query function.
 *
 * @public
 */
export interface Watch<T> {
  /**
   * Initiate a watch on the output of a query.
   *
   * This will subscribe to this query and call
   * the callback whenever the query result changes.
   *
   * **Important: If the client is already subscribed to this query with the
   * same arguments this callback will not be invoked until the query result is
   * updated.** To get the current, local result call
   * {@link react.Watch.localQueryResult}.
   *
   * @param callback - Function that is called whenever the query result changes.
   * @returns - A function that disposes of the subscription.
   */
  onUpdate(callback: () => void): () => void;

  /**
   * Get the current result of a query.
   *
   * This will only return a result if we're already subscribed to the query
   * and have received a result from the server or the query value has been set
   * optimistically.
   *
   * @returns The result of the query or `undefined` if it isn't known.
   * @throws An error if the query encountered an error on the server.
   */
  localQueryResult(): T | undefined;

  /**
   * @internal
   */
  localQueryLogs(): string[] | undefined;

  /**
   * Get the current {@link browser.QueryJournal} for this query.
   *
   * If we have not yet received a result for this query, this will be `undefined`.
   */
  journal(): QueryJournal | undefined;
}

/**
 * Options for {@link ConvexReactClient.watchQuery}.
 *
 * @public
 */
export interface WatchQueryOptions {
  /**
   * An (optional) journal produced from a previous execution of this query
   * function.
   *
   * If there is an existing subscription to a query function with the same
   * name and arguments, this journal will have no effect.
   */
  journal?: QueryJournal;

  /**
   * @internal
   */
  componentPath?: string;
}

/**
 * Options for {@link ConvexReactClient.mutation}.
 *
 * @public
 */
export interface MutationOptions<Args extends Record<string, Value>> {
  /**
   * An optimistic update to apply along with this mutation.
   *
   * An optimistic update locally updates queries while a mutation is pending.
   * Once the mutation completes, the update will be rolled back.
   */
  optimisticUpdate?: OptimisticUpdate<Args> | undefined;
}

/**
 * Options for {@link ConvexReactClient}.
 *
 * @public
 */
export interface ConvexReactClientOptions extends BaseConvexClientOptions {}

/**
 * A Convex client for use within React.
 *
 * This loads reactive queries and executes mutations over a WebSocket.
 *
 * @public
 */
export class ConvexReactClient {
  private address: string;
  private cachedSync?: BaseConvexClient | undefined;
  private listeners: Map<QueryToken, Set<() => void>>;
  private options: ConvexReactClientOptions;
  private closed = false;
  private _logger: Logger;

  private adminAuth?: string;
  private fakeUserIdentity?: UserIdentityAttributes | undefined;

  /**
   * @param address - The url of your Convex deployment, often provided
   * by an environment variable. E.g. `https://small-mouse-123.convex.cloud`.
   * @param options - See {@link ConvexReactClientOptions} for a full description.
   */
  constructor(address: string, options?: ConvexReactClientOptions) {
    // Validate address immediately since validation by the lazily-instantiated
    // internal client does not occur synchronously.
    if (address === undefined) {
      throw new Error(
        "No address provided to ConvexReactClient.\n" +
          "If trying to deploy to production, make sure to follow all the instructions found at https://docs.convex.dev/production/hosting/\n" +
          "If running locally, make sure to run `convex dev` and ensure the .env.local file is populated.",
      );
    }
    if (typeof address !== "string") {
      throw new Error(
        `ConvexReactClient requires a URL like 'https://happy-otter-123.convex.cloud', received something of type ${typeof address} instead.`,
      );
    }
    if (!address.includes("://")) {
      throw new Error("Provided address was not an absolute URL.");
    }
    this.address = address;
    this.listeners = new Map();
    this._logger =
      options?.logger === false
        ? instantiateNoopLogger({ verbose: options?.verbose ?? false })
        : options?.logger !== true && options?.logger
          ? options.logger
          : instantiateDefaultLogger({ verbose: options?.verbose ?? false });
    this.options = { ...options, logger: this._logger };
  }

  /**
   * Return the address for this client, useful for creating a new client.
   *
   * Not guaranteed to match the address with which this client was constructed:
   * it may be canonicalized.
   */
  get url() {
    return this.address;
  }

  /**
   * Lazily instantiate the `BaseConvexClient` so we don't create the WebSocket
   * when server-side rendering.
   *
   * @internal
   */
  get sync() {
    if (this.closed) {
      throw new Error("ConvexReactClient has already been closed.");
    }
    if (this.cachedSync) {
      return this.cachedSync;
    }
    this.cachedSync = new BaseConvexClient(
      this.address,
      (updatedQueries) => this.transition(updatedQueries),
      this.options,
    );
    if (this.adminAuth) {
      this.cachedSync.setAdminAuth(this.adminAuth, this.fakeUserIdentity);
    }
    return this.cachedSync;
  }

  /**
   * Set the authentication token to be used for subsequent queries and mutations.
   * `fetchToken` will be called automatically again if a token expires.
   * `fetchToken` should return `null` if the token cannot be retrieved, for example
   * when the user's rights were permanently revoked.
   * @param fetchToken - an async function returning the JWT-encoded OpenID Connect Identity Token
   * @param onChange - a callback that will be called when the authentication status changes
   */
  setAuth(
    fetchToken: AuthTokenFetcher,
    onChange?: (isAuthenticated: boolean) => void,
  ) {
    if (typeof fetchToken === "string") {
      throw new Error(
        "Passing a string to ConvexReactClient.setAuth is no longer supported, " +
          "please upgrade to passing in an async function to handle reauthentication.",
      );
    }
    this.sync.setAuth(
      fetchToken,
      onChange ??
        (() => {
          // Do nothing
        }),
    );
  }

  /**
   * Clear the current authentication token if set.
   */
  clearAuth() {
    this.sync.clearAuth();
  }

  /**
   * @internal
   */
  setAdminAuth(token: string, identity?: UserIdentityAttributes) {
    this.adminAuth = token;
    this.fakeUserIdentity = identity;
    if (this.closed) {
      throw new Error("ConvexReactClient has already been closed.");
    }
    if (this.cachedSync) {
      this.sync.setAdminAuth(token, identity);
    }
  }

  /**
   * Construct a new {@link Watch} on a Convex query function.
   *
   * **Most application code should not call this method directly. Instead use
   * the {@link useQuery} hook.**
   *
   * @param query - A {@link server.FunctionReference} for the public query to run.
   * @param args - An arguments object for the query. If this is omitted,
   * the arguments will be `{}`.
   * @param options - A {@link WatchQueryOptions} options object for this query.
   *
   * @returns The {@link Watch} object.
   */
  watchQuery<Query extends FunctionReference<"query">>(
    query: Query,
    ...argsAndOptions: ArgsAndOptions<Query, WatchQueryOptions>
  ): Watch<FunctionReturnType<Query>> {
    const [args, options] = argsAndOptions;
    const name = getFunctionName(query);
    return {
      onUpdate: (callback) => {
        const { queryToken, unsubscribe } = this.sync.subscribe(
          name as string,
          args,
          options,
        );

        const currentListeners = this.listeners.get(queryToken);
        if (currentListeners !== undefined) {
          currentListeners.add(callback);
        } else {
          this.listeners.set(queryToken, new Set([callback]));
        }

        return () => {
          if (this.closed) {
            return;
          }

          const currentListeners = this.listeners.get(queryToken)!;
          currentListeners.delete(callback);
          if (currentListeners.size === 0) {
            this.listeners.delete(queryToken);
          }
          unsubscribe();
        };
      },

      localQueryResult: () => {
        // Use the cached client because we can't have a query result if we don't
        // even have a client yet!
        if (this.cachedSync) {
          return this.cachedSync.localQueryResult(name, args);
        }
        return undefined;
      },

      localQueryLogs: () => {
        if (this.cachedSync) {
          return this.cachedSync.localQueryLogs(name, args);
        }
        return undefined;
      },

      journal: () => {
        if (this.cachedSync) {
          return this.cachedSync.queryJournal(name, args);
        }
        return undefined;
      },
    };
  }

  // Let's try out a queryOptions-style API.
  // This method is similar to the React Query API `queryClient.prefetchQuery()`.
  // In the future an ensureQueryData(): Promise<Data> method could exist.
  /**
   * Indicates likely future interest in a query subscription.
   *
   * The implementation currently immediately subscribes to a query. In the future this method
   * may prioritize some queries over others, fetch the query result without subscribing, or
   * do nothing in slow network connections or high load scenarios.
   *
   * To use this in a React component, call useQuery() and ignore the return value.
   *
   * @param queryOptions - A query (function reference from an api object) and its args, plus
   * an optional extendSubscriptionFor for how long to subscribe to the query.
   */
  prewarmQuery<Query extends FunctionReference<"query">>(
    queryOptions: ConvexQueryOptions<Query> & {
      extendSubscriptionFor?: number;
    },
  ) {
    const extendSubscriptionFor =
      queryOptions.extendSubscriptionFor ?? DEFAULT_EXTEND_SUBSCRIPTION_FOR;
    const watch = this.watchQuery(queryOptions.query, queryOptions.args || {});
    const unsubscribe = watch.onUpdate(() => {});
    setTimeout(unsubscribe, extendSubscriptionFor);
  }

  /**
   * Execute a mutation function.
   *
   * @param mutation - A {@link server.FunctionReference} for the public mutation
   * to run.
   * @param args - An arguments object for the mutation. If this is omitted,
   * the arguments will be `{}`.
   * @param options - A {@link MutationOptions} options object for the mutation.
   * @returns A promise of the mutation's result.
   */
  mutation<Mutation extends FunctionReference<"mutation">>(
    mutation: Mutation,
    ...argsAndOptions: ArgsAndOptions<
      Mutation,
      MutationOptions<FunctionArgs<Mutation>>
    >
  ): Promise<FunctionReturnType<Mutation>> {
    const [args, options] = argsAndOptions;
    const name = getFunctionName(mutation);
    return this.sync.mutation(name, args, options);
  }

  /**
   * Execute an action function.
   *
   * @param action - A {@link server.FunctionReference} for the public action
   * to run.
   * @param args - An arguments object for the action. If this is omitted,
   * the arguments will be `{}`.
   * @returns A promise of the action's result.
   */
  action<Action extends FunctionReference<"action">>(
    action: Action,
    ...args: OptionalRestArgs<Action>
  ): Promise<FunctionReturnType<Action>> {
    const name = getFunctionName(action);
    return this.sync.action(name, ...args);
  }

  /**
   * Fetch a query result once.
   *
   * **Most application code should subscribe to queries instead, using
   * the {@link useQuery} hook.**
   *
   * @param query - A {@link server.FunctionReference} for the public query
   * to run.
   * @param args - An arguments object for the query. If this is omitted,
   * the arguments will be `{}`.
   * @returns A promise of the query's result.
   */
  query<Query extends FunctionReference<"query">>(
    query: Query,
    ...args: OptionalRestArgs<Query>
  ): Promise<FunctionReturnType<Query>> {
    const watch = this.watchQuery(query, ...args);
    const existingResult = watch.localQueryResult();
    if (existingResult !== undefined) {
      return Promise.resolve(existingResult);
    }
    return new Promise((resolve, reject) => {
      const unsubscribe = watch.onUpdate(() => {
        unsubscribe();
        try {
          resolve(watch.localQueryResult());
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  /**
   * Get the current {@link ConnectionState} between the client and the Convex
   * backend.
   *
   * @returns The {@link ConnectionState} with the Convex backend.
   */
  connectionState(): ConnectionState {
    return this.sync.connectionState();
  }

  /**
   * Subscribe to the {@link ConnectionState} between the client and the Convex
   * backend, calling a callback each time it changes.
   *
   * Subscribed callbacks will be called when any part of ConnectionState changes.
   * ConnectionState may grow in future versions (e.g. to provide a array of
   * inflight requests) in which case callbacks would be called more frequently.
   * ConnectionState may also *lose* properties in future versions as we figure
   * out what information is most useful. As such this API is considered unstable.
   *
   * @returns An unsubscribe function to stop listening.
   */
  subscribeToConnectionState(
    cb: (connectionState: ConnectionState) => void,
  ): () => void {
    return this.sync.subscribeToConnectionState(cb);
  }

  /**
   * Get the logger for this client.
   *
   * @returns The {@link Logger} for this client.
   */
  get logger(): Logger {
    return this._logger;
  }

  /**
   * Close any network handles associated with this client and stop all subscriptions.
   *
   * Call this method when you're done with a {@link ConvexReactClient} to
   * dispose of its sockets and resources.
   *
   * @returns A `Promise` fulfilled when the connection has been completely closed.
   */
  async close(): Promise<void> {
    this.closed = true;
    // Prevent outstanding React batched updates from invoking listeners.
    this.listeners = new Map();
    if (this.cachedSync) {
      const sync = this.cachedSync;
      this.cachedSync = undefined;
      await sync.close();
    }
  }

  private transition(updatedQueries: QueryToken[]) {
    for (const queryToken of updatedQueries) {
      const callbacks = this.listeners.get(queryToken);
      if (callbacks) {
        for (const callback of callbacks) {
          callback();
        }
      }
    }
  }
}

const ConvexContext = React.createContext<ConvexReactClient>(
  undefined as unknown as ConvexReactClient, // in the future this will be a mocked client for testing
);

/**
 * Get the {@link ConvexReactClient} within a React component.
 *
 * This relies on the {@link ConvexProvider} being above in the React component tree.
 *
 * @returns The active {@link ConvexReactClient} object, or `undefined`.
 *
 * @public
 */
export function useConvex(): ConvexReactClient {
  return useContext(ConvexContext);
}

/**
 * Provides an active Convex {@link ConvexReactClient} to descendants of this component.
 *
 * Wrap your app in this component to use Convex hooks `useQuery`,
 * `useMutation`, and `useConvex`.
 *
 * @param props - an object with a `client` property that refers to a {@link ConvexReactClient}.
 *
 * @public
 */
export const ConvexProvider: React.FC<{
  client: ConvexReactClient;
  children?: React.ReactNode;
}> = ({ client, children }) => {
  return React.createElement(
    ConvexContext.Provider,
    { value: client },
    children,
  );
};

export type OptionalRestArgsOrSkip<FuncRef extends FunctionReference<any>> =
  FuncRef["_args"] extends EmptyObject
    ? [args?: EmptyObject | "skip"]
    : [args: FuncRef["_args"] | "skip"];

/**
 * Load a reactive query within a React component.
 *
 * This React hook contains internal state that will cause a rerender
 * whenever the query result changes.
 *
 * Throws an error if not used under {@link ConvexProvider}.
 *
 * @param query - a {@link server.FunctionReference} for the public query to run
 * like `api.dir1.dir2.filename.func`.
 * @param args - The arguments to the query function or the string "skip" if the
 * query should not be loaded.
 * @returns the result of the query. If the query is loading returns `undefined`.
 *
 * @public
 */
export function useQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): Query["_returnType"] | undefined {
  const skip = args[0] === "skip";
  const argsObject = args[0] === "skip" ? {} : parseArgs(args[0]);

  const queryReference =
    typeof query === "string"
      ? makeFunctionReference<"query", any, any>(query)
      : query;

  const queryName = getFunctionName(queryReference);

  const queries = useMemo(
    () =>
      skip
        ? ({} as RequestForQueries)
        : { query: { query: queryReference, args: argsObject } },
    // Stringify args so args that are semantically the same don't trigger a
    // rerender. Saves developers from adding `useMemo` on every args usage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(convexToJson(argsObject)), queryName, skip],
  );

  const results = useQueries(queries);
  const result = results["query"];
  if (result instanceof Error) {
    throw result;
  }
  return result;
}

/**
 * Construct a new {@link ReactMutation}.
 *
 * Mutation objects can be called like functions to request execution of the
 * corresponding Convex function, or further configured with
 * [optimistic updates](https://docs.convex.dev/using/optimistic-updates).
 *
 * The value returned by this hook is stable across renders, so it can be used
 * by React dependency arrays and memoization logic relying on object identity
 * without causing rerenders.
 *
 * Throws an error if not used under {@link ConvexProvider}.
 *
 * @param mutation - A {@link server.FunctionReference} for the public mutation
 * to run like `api.dir1.dir2.filename.func`.
 * @returns The {@link ReactMutation} object with that name.
 *
 * @public
 */
export function useMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation,
): ReactMutation<Mutation> {
  const mutationReference =
    typeof mutation === "string"
      ? makeFunctionReference<"mutation", any, any>(mutation)
      : mutation;

  const convex = useContext(ConvexContext);
  if (convex === undefined) {
    throw new Error(
      "Could not find Convex client! `useMutation` must be used in the React component " +
        "tree under `ConvexProvider`. Did you forget it? " +
        "See https://docs.convex.dev/quick-start#set-up-convex-in-your-react-app",
    );
  }
  return useMemo(
    () => createMutation(mutationReference, convex),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [convex, getFunctionName(mutationReference)],
  );
}

/**
 * Construct a new {@link ReactAction}.
 *
 * Action objects can be called like functions to request execution of the
 * corresponding Convex function.
 *
 * The value returned by this hook is stable across renders, so it can be used
 * by React dependency arrays and memoization logic relying on object identity
 * without causing rerenders.
 *
 * Throws an error if not used under {@link ConvexProvider}.
 *
 * @param action - A {@link server.FunctionReference} for the public action
 * to run like `api.dir1.dir2.filename.func`.
 * @returns The {@link ReactAction} object with that name.
 *
 * @public
 */
export function useAction<Action extends FunctionReference<"action">>(
  action: Action,
): ReactAction<Action> {
  const convex = useContext(ConvexContext);
  const actionReference =
    typeof action === "string"
      ? makeFunctionReference<"action", any, any>(action)
      : action;

  if (convex === undefined) {
    throw new Error(
      "Could not find Convex client! `useAction` must be used in the React component " +
        "tree under `ConvexProvider`. Did you forget it? " +
        "See https://docs.convex.dev/quick-start#set-up-convex-in-your-react-app",
    );
  }
  return useMemo(
    () => createAction(actionReference, convex),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [convex, getFunctionName(actionReference)],
  );
}

/**
 * React hook to get the current {@link ConnectionState} and subscribe to changes.
 *
 * This hook returns the current connection state and automatically rerenders
 * when any part of the connection state changes (e.g., when going online/offline,
 * when requests start/complete, etc.).
 *
 * The shape of ConnectionState may change in the future which may cause this
 * hook to rerender more frequently.
 *
 * Throws an error if not used under {@link ConvexProvider}.
 *
 * @returns The current {@link ConnectionState} with the Convex backend.
 *
 * @public
 */
export function useConvexConnectionState(): ConnectionState {
  const convex = useContext(ConvexContext);
  if (convex === undefined) {
    throw new Error(
      "Could not find Convex client! `useConvexConnectionState` must be used in the React component " +
        "tree under `ConvexProvider`. Did you forget it? " +
        "See https://docs.convex.dev/quick-start#set-up-convex-in-your-react-app",
    );
  }

  const getCurrentValue = useCallback(() => {
    return convex.connectionState();
  }, [convex]);

  const subscribe = useCallback(
    (callback: () => void) => {
      return convex.subscribeToConnectionState(() => {
        callback();
      });
    },
    [convex],
  );

  return useSubscription({ getCurrentValue, subscribe });
}

// When a function is called with a single argument that looks like a
// React SyntheticEvent it was likely called as an event handler.
function assertNotAccidentalArgument(value: any) {
  // these are properties of a React.SyntheticEvent
  // https://reactjs.org/docs/events.html
  if (
    typeof value === "object" &&
    value !== null &&
    "bubbles" in value &&
    "persist" in value &&
    "isDefaultPrevented" in value
  ) {
    throw new Error(
      `Convex function called with SyntheticEvent object. Did you use a Convex function as an event handler directly? Event handlers like onClick receive an event object as their first argument. These SyntheticEvent objects are not valid Convex values. Try wrapping the function like \`const handler = () => myMutation();\` and using \`handler\` in the event handler.`,
    );
  }
}
