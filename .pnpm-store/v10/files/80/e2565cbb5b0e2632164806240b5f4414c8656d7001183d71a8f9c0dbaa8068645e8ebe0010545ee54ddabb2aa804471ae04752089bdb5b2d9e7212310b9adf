import { validateDeploymentUrl } from "../common/index.js";
import {
  BaseConvexClient,
  BaseConvexClientOptions,
  MutationOptions,
  QueryToken,
  UserIdentityAttributes,
} from "./index.js";
import {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "../server/index.js";
import { getFunctionName } from "../server/api.js";
import { AuthTokenFetcher } from "./sync/authentication_manager.js";
import { ConnectionState } from "./sync/client.js";

// In Node.js builds this points to a bundled WebSocket implementation. If no
// WebSocket implementation is manually specified or globally available,
// this one is used.
let defaultWebSocketConstructor: typeof WebSocket | undefined;

/** internal */
export function setDefaultWebSocketConstructor(ws: typeof WebSocket) {
  defaultWebSocketConstructor = ws;
}

export type ConvexClientOptions = BaseConvexClientOptions & {
  /**
   * `disabled` makes onUpdate callback registration a no-op and actions,
   * mutations and one-shot queries throw. Setting disabled to true may be
   * useful for server-side rendering, where subscriptions don't make sense.
   */
  disabled?: boolean;
  /**
   * Whether to prompt users in browsers about queued or in-flight mutations.
   * This only works in environments where `window.onbeforeunload` is available.
   *
   * Defaults to true when `window` is defined, otherwise false.
   */
  unsavedChangesWarning?: boolean;
};

/**
 * Stops callbacks from running.
 *
 * @public
 */
export type Unsubscribe<T> = {
  /** Stop calling callback when query results changes. If this is the last listener on this query, stop received updates. */
  (): void;
  /** Stop calling callback when query results changes. If this is the last listener on this query, stop received updates. */
  unsubscribe(): void;
  /** Get the last known value, possibly with local optimistic updates applied. */
  getCurrentValue(): T | undefined;
  /** @internal */
  getQueryLogs(): string[] | undefined;
};

/**
 * Subscribes to Convex query functions and executes mutations and actions over a WebSocket.
 *
 * Optimistic updates for mutations are not provided for this client.
 * Third party clients may choose to wrap {@link browser.BaseConvexClient} for additional control.
 *
 * ```ts
 * const client = new ConvexClient("https://happy-otter-123.convex.cloud");
 * const unsubscribe = client.onUpdate(api.messages.list, {}, (messages) => {
 *   console.log(messages[0].body);
 * });
 * ```
 *
 * @public
 */
export class ConvexClient {
  private listeners: Set<QueryInfo>;
  private _client: BaseConvexClient | undefined;
  // A synthetic server event to run callbacks the first time
  private callNewListenersWithCurrentValuesTimer:
    | ReturnType<typeof setTimeout>
    | undefined;
  private _closed: boolean;
  private _disabled: boolean;
  /**
   * Once closed no registered callbacks will fire again.
   */
  get closed(): boolean {
    return this._closed;
  }
  get client(): BaseConvexClient {
    if (this._client) return this._client;
    throw new Error("ConvexClient is disabled");
  }
  get disabled(): boolean {
    return this._disabled;
  }

  /**
   * Construct a client and immediately initiate a WebSocket connection to the passed address.
   *
   * @public
   */
  constructor(address: string, options: ConvexClientOptions = {}) {
    if (options.skipConvexDeploymentUrlCheck !== true) {
      validateDeploymentUrl(address);
    }
    const { disabled, ...baseOptions } = options;
    this._closed = false;
    this._disabled = !!disabled;
    if (
      defaultWebSocketConstructor &&
      !("webSocketConstructor" in baseOptions) &&
      typeof WebSocket === "undefined"
    ) {
      baseOptions.webSocketConstructor = defaultWebSocketConstructor;
    }
    if (
      typeof window === "undefined" &&
      !("unsavedChangesWarning" in baseOptions)
    ) {
      baseOptions.unsavedChangesWarning = false;
    }
    if (!this.disabled) {
      this._client = new BaseConvexClient(
        address,
        (updatedQueries) => this._transition(updatedQueries),
        baseOptions,
      );
    }
    this.listeners = new Set();
  }

  /**
   * Call a callback whenever a new result for a query is received. The callback
   * will run soon after being registered if a result for the query is already
   * in memory.
   *
   * The return value is an {@link Unsubscribe} object which is both a function
   * an an object with properties. Both of the patterns below work with this object:
   *
   *```ts
   * // call the return value as a function
   * const unsubscribe = client.onUpdate(api.messages.list, {}, (messages) => {
   *   console.log(messages);
   * });
   * unsubscribe();
   *
   * // unpack the return value into its properties
   * const {
   *   getCurrentValue,
   *   unsubscribe,
   * } = client.onUpdate(api.messages.list, {}, (messages) => {
   *   console.log(messages);
   * });
   *```
   *
   * @param query - A {@link server.FunctionReference} for the public query to run.
   * @param args - The arguments to run the query with.
   * @param callback - Function to call when the query result updates.
   * @param onError - Function to call when the query result updates with an error.
   * If not provided, errors will be thrown instead of calling the callback.
   *
   * @return an {@link Unsubscribe} function to stop calling the onUpdate function.
   */
  onUpdate<Query extends FunctionReference<"query">>(
    query: Query,
    args: FunctionArgs<Query>,
    callback: (result: FunctionReturnType<Query>) => unknown,
    onError?: (e: Error) => unknown,
  ): Unsubscribe<Query["_returnType"]> {
    if (this.disabled) {
      const disabledUnsubscribe = (() => {}) as Unsubscribe<
        Query["_returnType"]
      >;
      const unsubscribeProps: RemoveCallSignature<
        Unsubscribe<Query["_returnType"]>
      > = {
        unsubscribe: disabledUnsubscribe,
        getCurrentValue: () => undefined,
        getQueryLogs: () => undefined,
      };
      Object.assign(disabledUnsubscribe, unsubscribeProps);
      return disabledUnsubscribe;
    }

    // BaseConvexClient takes care of deduplicating queries subscriptions...
    const { queryToken, unsubscribe } = this.client.subscribe(
      getFunctionName(query),
      args,
    );

    // ...but we still need to bookkeep callbacks to actually call them.
    const queryInfo: QueryInfo = {
      queryToken,
      callback,
      onError,
      unsubscribe,
      hasEverRun: false,
      query,
      args,
    };
    this.listeners.add(queryInfo);

    // If the callback is registered for a query with a result immediately available
    // schedule a fake transition to call the callback soon instead of waiting for
    // a new server update (which could take seconds or days).
    if (
      this.queryResultReady(queryToken) &&
      this.callNewListenersWithCurrentValuesTimer === undefined
    ) {
      this.callNewListenersWithCurrentValuesTimer = setTimeout(
        () => this.callNewListenersWithCurrentValues(),
        0,
      );
    }

    const unsubscribeProps: RemoveCallSignature<
      Unsubscribe<Query["_returnType"]>
    > = {
      unsubscribe: () => {
        if (this.closed) {
          // all unsubscribes already ran
          return;
        }
        this.listeners.delete(queryInfo);
        unsubscribe();
      },
      getCurrentValue: () => this.client.localQueryResultByToken(queryToken),
      getQueryLogs: () => this.client.localQueryLogs(queryToken),
    };
    const ret = unsubscribeProps.unsubscribe as Unsubscribe<
      Query["_returnType"]
    >;
    Object.assign(ret, unsubscribeProps);
    return ret;
  }

  // Run all callbacks that have never been run before if they have a query
  // result available now.
  private callNewListenersWithCurrentValues() {
    this.callNewListenersWithCurrentValuesTimer = undefined;
    this._transition([], true);
  }

  private queryResultReady(queryToken: QueryToken): boolean {
    return this.client.hasLocalQueryResultByToken(queryToken);
  }

  async close() {
    if (this.disabled) return;
    // prevent pending updates
    this.listeners.clear();
    this._closed = true;
    return this.client.close();
  }

  /**
   * Get the current JWT auth token and decoded claims.
   */
  getAuth(): { token: string; decoded: Record<string, any> } | undefined {
    if (this.disabled) return;
    return this.client.getCurrentAuthClaims();
  }

  /**
   * Set the authentication token to be used for subsequent queries and mutations.
   * `fetchToken` will be called automatically again if a token expires.
   * `fetchToken` should return `null` if the token cannot be retrieved, for example
   * when the user's rights were permanently revoked.
   * @param fetchToken - an async function returning the JWT (typically an OpenID Connect Identity Token)
   * @param onChange - a callback that will be called when the authentication status changes
   */
  setAuth(
    fetchToken: AuthTokenFetcher,
    onChange?: (isAuthenticated: boolean) => void,
  ) {
    if (this.disabled) return;
    this.client.setAuth(
      fetchToken,
      onChange ??
        (() => {
          // Do nothing
        }),
    );
  }

  /**
   * @internal
   */
  setAdminAuth(token: string, identity?: UserIdentityAttributes) {
    if (this.closed) {
      throw new Error("ConvexClient has already been closed.");
    }
    if (this.disabled) return;
    this.client.setAdminAuth(token, identity);
  }

  /**
   * @internal
   */
  _transition(updatedQueries: QueryToken[], callNewListeners = false) {
    // Deduping subscriptions happens in the BaseConvexClient, so not much to do here.

    // Call all callbacks in the order they were registered
    for (const queryInfo of this.listeners) {
      const { callback, queryToken, onError, hasEverRun } = queryInfo;
      if (
        updatedQueries.includes(queryToken) ||
        (callNewListeners &&
          !hasEverRun &&
          this.client.hasLocalQueryResultByToken(queryToken))
      ) {
        queryInfo.hasEverRun = true;
        let newValue;
        try {
          newValue = this.client.localQueryResultByToken(queryToken);
        } catch (error) {
          if (!(error instanceof Error)) throw error;
          if (onError) {
            onError(
              error,
              "Second argument to onUpdate onError is reserved for later use",
            );
          } else {
            // Make some noise without unsubscribing or failing to call other callbacks.
            void Promise.reject(error);
          }
          continue;
        }
        callback(
          newValue,
          "Second argument to onUpdate callback is reserved for later use",
        );
      }
    }
  }

  /**
   * Execute a mutation function.
   *
   * @param mutation - A {@link server.FunctionReference} for the public mutation
   * to run.
   * @param args - An arguments object for the mutation.
   * @param options - A {@link MutationOptions} options object for the mutation.
   * @returns A promise of the mutation's result.
   */
  async mutation<Mutation extends FunctionReference<"mutation">>(
    mutation: Mutation,
    args: FunctionArgs<Mutation>,
    options?: MutationOptions,
  ): Promise<Awaited<FunctionReturnType<Mutation>>> {
    if (this.disabled) throw new Error("ConvexClient is disabled");
    return await this.client.mutation(getFunctionName(mutation), args, options);
  }

  /**
   * Execute an action function.
   *
   * @param action - A {@link server.FunctionReference} for the public action
   * to run.
   * @param args - An arguments object for the action.
   * @returns A promise of the action's result.
   */
  async action<Action extends FunctionReference<"action">>(
    action: Action,
    args: FunctionArgs<Action>,
  ): Promise<Awaited<FunctionReturnType<Action>>> {
    if (this.disabled) throw new Error("ConvexClient is disabled");
    return await this.client.action(getFunctionName(action), args);
  }

  /**
   * Fetch a query result once.
   *
   * @param query - A {@link server.FunctionReference} for the public query
   * to run.
   * @param args - An arguments object for the query.
   * @returns A promise of the query's result.
   */
  async query<Query extends FunctionReference<"query">>(
    query: Query,
    args: Query["_args"],
  ): Promise<Awaited<Query["_returnType"]>> {
    if (this.disabled) throw new Error("ConvexClient is disabled");
    const value = this.client.localQueryResult(getFunctionName(query), args) as
      | Awaited<Query["_returnType"]>
      | undefined;
    if (value !== undefined) return Promise.resolve(value);

    return new Promise((resolve, reject) => {
      const { unsubscribe } = this.onUpdate(
        query,
        args,
        (value) => {
          unsubscribe();
          resolve(value);
        },
        (e: Error) => {
          unsubscribe();
          reject(e);
        },
      );
    });
  }

  /**
   * Get the current {@link ConnectionState} between the client and the Convex
   * backend.
   *
   * @returns The {@link ConnectionState} with the Convex backend.
   */
  connectionState(): ConnectionState {
    if (this.disabled) throw new Error("ConvexClient is disabled");
    return this.client.connectionState();
  }

  /**
   * Subscribe to the {@link ConnectionState} between the client and the Convex
   * backend, calling a callback each time it changes.
   *
   * Subscribed callbacks will be called when any part of ConnectionState changes.
   * ConnectionState may grow in future versions (e.g. to provide a array of
   * inflight requests) in which case callbacks would be called more frequently.
   *
   * @returns An unsubscribe function to stop listening.
   */
  subscribeToConnectionState(
    cb: (connectionState: ConnectionState) => void,
  ): () => void {
    if (this.disabled) return () => {};
    return this.client.subscribeToConnectionState(cb);
  }
}

// internal information tracked about each registered callback
type QueryInfo = {
  callback: (result: any, meta: unknown) => unknown;
  onError: ((e: Error, meta: unknown) => unknown) | undefined;
  unsubscribe: () => void;
  queryToken: QueryToken;
  hasEverRun: boolean;
  // query and args are just here for debugging, the queryToken is authoritative
  query: FunctionReference<"query">;
  args: any;
};

type RemoveCallSignature<T> = Omit<T, never>;
