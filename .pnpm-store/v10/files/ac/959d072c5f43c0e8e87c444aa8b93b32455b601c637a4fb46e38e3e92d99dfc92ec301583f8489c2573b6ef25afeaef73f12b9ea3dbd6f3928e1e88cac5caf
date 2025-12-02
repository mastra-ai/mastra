import { Value } from "../../values/index.js";
import { Logger } from "../logging.js";
import { OptimisticUpdate } from "./optimistic_updates.js";
import { QueryJournal, RequestId, TS } from "./protocol.js";
import { QueryToken } from "./udf_path_utils.js";
import { FunctionResult } from "./function_result.js";
import { AuthTokenFetcher } from "./authentication_manager.js";
export { type AuthTokenFetcher } from "./authentication_manager.js";
/**
 * Options for {@link BaseConvexClient}.
 *
 * @public
 */
export interface BaseConvexClientOptions {
    /**
     * Whether to prompt the user if they have unsaved changes pending
     * when navigating away or closing a web page.
     *
     * This is only possible when the `window` object exists, i.e. in a browser.
     *
     * The default value is `true` in browsers.
     */
    unsavedChangesWarning?: boolean;
    /**
     * Specifies an alternate
     * [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
     * constructor to use for client communication with the Convex cloud.
     * The default behavior is to use `WebSocket` from the global environment.
     */
    webSocketConstructor?: typeof WebSocket;
    /**
     * Adds additional logging for debugging purposes.
     *
     * The default value is `false`.
     */
    verbose?: boolean;
    /**
     * A logger, `true`, or `false`. If not provided or `true`, logs to the console.
     * If `false`, logs are not printed anywhere.
     *
     * You can construct your own logger to customize logging to log elsewhere.
     * A logger is an object with 4 methods: log(), warn(), error(), and logVerbose().
     * These methods can receive multiple arguments of any types, like console.log().
     */
    logger?: Logger | boolean;
    /**
     * Sends additional metrics to Convex for debugging purposes.
     *
     * The default value is `false`.
     */
    reportDebugInfoToConvex?: boolean;
    /**
     * This API is experimental: it may change or disappear.
     *
     * A function to call on receiving abnormal WebSocket close messages from the
     * connected Convex deployment. The content of these messages is not stable,
     * it is an implementation detail that may change.
     *
     * Consider this API an observability stopgap until higher level codes with
     * recommendations on what to do are available, which could be a more stable
     * interface instead of `string`.
     *
     * Check `connectionState` for more quantitative metrics about connection status.
     */
    onServerDisconnectError?: (message: string) => void;
    /**
     * Skip validating that the Convex deployment URL looks like
     * `https://happy-animal-123.convex.cloud` or localhost.
     *
     * This can be useful if running a self-hosted Convex backend that uses a different
     * URL.
     *
     * The default value is `false`
     */
    skipConvexDeploymentUrlCheck?: boolean;
    /**
     * If using auth, the number of seconds before a token expires that we should refresh it.
     *
     * The default value is `2`.
     */
    authRefreshTokenLeewaySeconds?: number;
    /**
     * This API is experimental: it may change or disappear.
     *
     * Whether query, mutation, and action requests should be held back
     * until the first auth token can be sent.
     *
     * Opting into this behavior works well for pages that should
     * only be viewed by authenticated clients.
     *
     * Defaults to false, not waiting for an auth token.
     */
    expectAuth?: boolean;
}
/**
 * State describing the client's connection with the Convex backend.
 *
 * @public
 */
export type ConnectionState = {
    hasInflightRequests: boolean;
    isWebSocketConnected: boolean;
    timeOfOldestInflightRequest: Date | null;
    /**
     * True if the client has ever opened a WebSocket to the "ready" state.
     */
    hasEverConnected: boolean;
    /**
     * The number of times this client has connected to the Convex backend.
     *
     * A number of things can cause the client to reconnect -- server errors,
     * bad internet, auth expiring. But this number being high is an indication
     * that the client is having trouble keeping a stable connection.
     */
    connectionCount: number;
    /**
     * The number of times this client has tried (and failed) to connect to the Convex backend.
     */
    connectionRetries: number;
    /**
     * The number of mutations currently in flight.
     */
    inflightMutations: number;
    /**
     * The number of actions currently in flight.
     */
    inflightActions: number;
};
/**
 * Options for {@link BaseConvexClient.subscribe}.
 *
 * @public
 */
export interface SubscribeOptions {
    /**
     * An (optional) journal produced from a previous execution of this query
     * function.
     *
     * If there is an existing subscription to a query function with the same
     * name and arguments, this journal will have no effect.
     */
    journal?: QueryJournal;
}
/**
 * Options for {@link BaseConvexClient.mutation}.
 *
 * @public
 */
export interface MutationOptions {
    /**
     * An optimistic update to apply along with this mutation.
     *
     * An optimistic update locally updates queries while a mutation is pending.
     * Once the mutation completes, the update will be rolled back.
     */
    optimisticUpdate?: OptimisticUpdate<any> | undefined;
}
/**
 * Type describing updates to a query within a `Transition`.
 *
 * @public
 */
export type QueryModification = {
    kind: "Updated";
    result: FunctionResult | undefined;
} | {
    kind: "Removed";
};
/**
 * Object describing a transition passed into the `onTransition` handler.
 *
 * These can be from receiving a transition from the server, or from applying an
 * optimistic update locally.
 *
 * @public
 */
export type Transition = {
    queries: Array<{
        token: QueryToken;
        modification: QueryModification;
    }>;
    reflectedMutations: Array<{
        requestId: RequestId;
        result: FunctionResult;
    }>;
    timestamp: TS;
};
/**
 * Low-level client for directly integrating state management libraries
 * with Convex.
 *
 * Most developers should use higher level clients, like
 * the {@link ConvexHttpClient} or the React hook based {@link react.ConvexReactClient}.
 *
 * @public
 */
export declare class BaseConvexClient {
    private readonly address;
    private readonly state;
    private readonly requestManager;
    private readonly webSocketManager;
    private readonly authenticationManager;
    private remoteQuerySet;
    private readonly optimisticQueryResults;
    private _transitionHandlerCounter;
    private _nextRequestId;
    private _onTransitionFns;
    private readonly _sessionId;
    private firstMessageReceived;
    private readonly debug;
    private readonly logger;
    private maxObservedTimestamp;
    private connectionStateSubscribers;
    private nextConnectionStateSubscriberId;
    private _lastPublishedConnectionState;
    /**
     * @param address - The url of your Convex deployment, often provided
     * by an environment variable. E.g. `https://small-mouse-123.convex.cloud`.
     * @param onTransition - A callback receiving an array of query tokens
     * corresponding to query results that have changed -- additional handlers
     * can be added via `addOnTransitionHandler`.
     * @param options - See {@link BaseConvexClientOptions} for a full description.
     */
    constructor(address: string, onTransition: (updatedQueries: QueryToken[]) => void, options?: BaseConvexClientOptions);
    /**
     * Return true if there is outstanding work from prior to the time of the most recent restart.
     * This indicates that the client has not proven itself to have gotten past the issue that
     * potentially led to the restart. Use this to influence when to reset backoff after a failure.
     */
    private hasSyncedPastLastReconnect;
    private observedTimestamp;
    getMaxObservedTimestamp(): import("../../vendor/long.js").Long | undefined;
    /**
     * Compute the current query results based on the remoteQuerySet and the
     * current optimistic updates and call `onTransition` for all the changed
     * queries.
     *
     * @param completedMutations - A set of mutation IDs whose optimistic updates
     * are no longer needed.
     */
    private notifyOnQueryResultChanges;
    private handleTransition;
    /**
     * Add a handler that will be called on a transition.
     *
     * Any external side effects (e.g. setting React state) should be handled here.
     *
     * @param fn
     *
     * @returns
     */
    addOnTransitionHandler(fn: (transition: Transition) => void): () => boolean;
    /**
     * Get the current JWT auth token and decoded claims.
     */
    getCurrentAuthClaims(): {
        token: string;
        decoded: Record<string, any>;
    } | undefined;
    /**
     * Set the authentication token to be used for subsequent queries and mutations.
     * `fetchToken` will be called automatically again if a token expires.
     * `fetchToken` should return `null` if the token cannot be retrieved, for example
     * when the user's rights were permanently revoked.
     * @param fetchToken - an async function returning the JWT-encoded OpenID Connect Identity Token
     * @param onChange - a callback that will be called when the authentication status changes
     */
    setAuth(fetchToken: AuthTokenFetcher, onChange: (isAuthenticated: boolean) => void): void;
    hasAuth(): boolean;
    clearAuth(): void;
    /**
     * Subscribe to a query function.
     *
     * Whenever this query's result changes, the `onTransition` callback
     * passed into the constructor will be called.
     *
     * @param name - The name of the query.
     * @param args - An arguments object for the query. If this is omitted, the
     * arguments will be `{}`.
     * @param options - A {@link SubscribeOptions} options object for this query.
  
     * @returns An object containing a {@link QueryToken} corresponding to this
     * query and an `unsubscribe` callback.
     */
    subscribe(name: string, args?: Record<string, Value>, options?: SubscribeOptions): {
        queryToken: QueryToken;
        unsubscribe: () => void;
    };
    /**
     * A query result based only on the current, local state.
     *
     * The only way this will return a value is if we're already subscribed to the
     * query or its value has been set optimistically.
     */
    localQueryResult(udfPath: string, args?: Record<string, Value>): Value | undefined;
    /**
     * Retrieve the current {@link QueryJournal} for this query function.
     *
     * If we have not yet received a result for this query, this will be `undefined`.
     *
     * @param name - The name of the query.
     * @param args - The arguments object for this query.
     * @returns The query's {@link QueryJournal} or `undefined`.
     */
    queryJournal(name: string, args?: Record<string, Value>): QueryJournal | undefined;
    /**
     * Get the current {@link ConnectionState} between the client and the Convex
     * backend.
     *
     * @returns The {@link ConnectionState} with the Convex backend.
     */
    connectionState(): ConnectionState;
    /**
     * Call this whenever the connection state may have changed in a way that could
     * require publishing it. Schedules a possibly update.
     */
    private markConnectionStateDirty;
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
    subscribeToConnectionState(cb: (connectionState: ConnectionState) => void): () => void;
    /**
     * Execute a mutation function.
     *
     * @param name - The name of the mutation.
     * @param args - An arguments object for the mutation. If this is omitted,
     * the arguments will be `{}`.
     * @param options - A {@link MutationOptions} options object for this mutation.
  
     * @returns - A promise of the mutation's result.
     */
    mutation(name: string, args?: Record<string, Value>, options?: MutationOptions): Promise<any>;
    /**
     * Execute an action function.
     *
     * @param name - The name of the action.
     * @param args - An arguments object for the action. If this is omitted,
     * the arguments will be `{}`.
     * @returns A promise of the action's result.
     */
    action(name: string, args?: Record<string, Value>): Promise<any>;
    /**
     * Close any network handles associated with this client and stop all subscriptions.
     *
     * Call this method when you're done with an {@link BaseConvexClient} to
     * dispose of its sockets and resources.
     *
     * @returns A `Promise` fulfilled when the connection has been completely closed.
     */
    close(): Promise<void>;
    /**
     * Return the address for this client, useful for creating a new client.
     *
     * Not guaranteed to match the address with which this client was constructed:
     * it may be canonicalized.
     */
    get url(): string;
    private mark;
    /**
     * Reports performance marks to the server. This should only be called when
     * we have a functional websocket.
     */
    private reportMarks;
    private tryReportLongDisconnect;
}
//# sourceMappingURL=client.d.ts.map