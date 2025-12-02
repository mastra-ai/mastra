import { version } from "../../index.js";
import { convexToJson, Value } from "../../values/index.js";
import {
  createHybridErrorStacktrace,
  forwardData,
  instantiateDefaultLogger,
  instantiateNoopLogger,
  logFatalError,
  Logger,
} from "../logging.js";
import { LocalSyncState } from "./local_state.js";
import { RequestManager } from "./request_manager.js";
import {
  OptimisticLocalStore,
  OptimisticUpdate,
} from "./optimistic_updates.js";
import {
  OptimisticQueryResults,
  QueryResultsMap,
} from "./optimistic_updates_impl.js";
import {
  ActionRequest,
  MutationRequest,
  QueryId,
  QueryJournal,
  ServerMessage,
  RequestId,
  TS,
  UserIdentityAttributes,
} from "./protocol.js";
import { RemoteQuerySet } from "./remote_query_set.js";
import { QueryToken, serializePathAndArgs } from "./udf_path_utils.js";
import { ReconnectMetadata, WebSocketManager } from "./web_socket_manager.js";
import { newSessionId } from "./session.js";
import { FunctionResult } from "./function_result.js";
import {
  AuthenticationManager,
  AuthTokenFetcher,
} from "./authentication_manager.js";
export { type AuthTokenFetcher } from "./authentication_manager.js";
import { getMarksReport, mark, MarkName } from "./metrics.js";
import { parseArgs, validateDeploymentUrl } from "../../common/index.js";
import { ConvexError } from "../../values/errors.js";
import { jwtDecode } from "../../vendor/jwt-decode/index.js";

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

  /**
   * @internal
   */
  componentPath?: string | undefined;
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
export type QueryModification =
  // `undefined` generally comes from an optimistic update setting the query to be loading
  { kind: "Updated"; result: FunctionResult | undefined } | { kind: "Removed" };

/**
 * Object describing a transition passed into the `onTransition` handler.
 *
 * These can be from receiving a transition from the server, or from applying an
 * optimistic update locally.
 *
 * @public
 */
export type Transition = {
  queries: Array<{ token: QueryToken; modification: QueryModification }>;
  reflectedMutations: Array<{ requestId: RequestId; result: FunctionResult }>;
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
export class BaseConvexClient {
  private readonly address: string;
  private readonly state: LocalSyncState;
  private readonly requestManager: RequestManager;
  private readonly webSocketManager: WebSocketManager;
  private readonly authenticationManager: AuthenticationManager;
  private remoteQuerySet: RemoteQuerySet;
  private readonly optimisticQueryResults: OptimisticQueryResults;
  private _transitionHandlerCounter = 0;
  private _nextRequestId: RequestId;
  private _onTransitionFns: Map<number, (transition: Transition) => void> =
    new Map();
  private readonly _sessionId: string;
  private firstMessageReceived = false;
  private readonly debug: boolean;
  private readonly logger: Logger;
  private maxObservedTimestamp: TS | undefined;
  private connectionStateSubscribers = new Map<
    number,
    (connectionState: ConnectionState) => void
  >();
  private nextConnectionStateSubscriberId: number = 0;
  private _lastPublishedConnectionState: ConnectionState | undefined;

  /**
   * @param address - The url of your Convex deployment, often provided
   * by an environment variable. E.g. `https://small-mouse-123.convex.cloud`.
   * @param onTransition - A callback receiving an array of query tokens
   * corresponding to query results that have changed -- additional handlers
   * can be added via `addOnTransitionHandler`.
   * @param options - See {@link BaseConvexClientOptions} for a full description.
   */
  constructor(
    address: string,
    onTransition: (updatedQueries: QueryToken[]) => void,
    options?: BaseConvexClientOptions,
  ) {
    if (typeof address === "object") {
      throw new Error(
        "Passing a ClientConfig object is no longer supported. Pass the URL of the Convex deployment as a string directly.",
      );
    }
    if (options?.skipConvexDeploymentUrlCheck !== true) {
      validateDeploymentUrl(address);
    }
    options = { ...options };
    const authRefreshTokenLeewaySeconds =
      options.authRefreshTokenLeewaySeconds ?? 2;
    let webSocketConstructor = options.webSocketConstructor;
    if (!webSocketConstructor && typeof WebSocket === "undefined") {
      throw new Error(
        "No WebSocket global variable defined! To use Convex in an environment without WebSocket try the HTTP client: https://docs.convex.dev/api/classes/browser.ConvexHttpClient",
      );
    }
    webSocketConstructor = webSocketConstructor || WebSocket;
    this.debug = options.reportDebugInfoToConvex ?? false;
    this.address = address;
    this.logger =
      options.logger === false
        ? instantiateNoopLogger({ verbose: options.verbose ?? false })
        : options.logger !== true && options.logger
          ? options.logger
          : instantiateDefaultLogger({ verbose: options.verbose ?? false });
    // Substitute http(s) with ws(s)
    const i = address.search("://");
    if (i === -1) {
      throw new Error("Provided address was not an absolute URL.");
    }
    const origin = address.substring(i + 3); // move past the double slash
    const protocol = address.substring(0, i);
    let wsProtocol;
    if (protocol === "http") {
      wsProtocol = "ws";
    } else if (protocol === "https") {
      wsProtocol = "wss";
    } else {
      throw new Error(`Unknown parent protocol ${protocol}`);
    }
    const wsUri = `${wsProtocol}://${origin}/api/${version}/sync`;

    this.state = new LocalSyncState();
    this.remoteQuerySet = new RemoteQuerySet(
      (queryId) => this.state.queryPath(queryId),
      this.logger,
    );
    this.requestManager = new RequestManager(
      this.logger,
      this.markConnectionStateDirty,
    );

    // This is a callback for AuthenticationManager (which can't call
    // this synchronously, the callback wouldn't work) so the initial
    // pause for expectAuth we call it at the end of this constructor.
    const pauseSocket = () => {
      this.webSocketManager.pause();
      this.state.pause();
    };
    this.authenticationManager = new AuthenticationManager(
      this.state,
      {
        authenticate: (token) => {
          const message = this.state.setAuth(token);
          this.webSocketManager.sendMessage(message);
          return message.baseVersion;
        },
        stopSocket: () => this.webSocketManager.stop(),
        tryRestartSocket: () => this.webSocketManager.tryRestart(),
        pauseSocket,
        resumeSocket: () => this.webSocketManager.resume(),
        clearAuth: () => {
          this.clearAuth();
        },
      },
      {
        logger: this.logger,
        refreshTokenLeewaySeconds: authRefreshTokenLeewaySeconds,
      },
    );
    this.optimisticQueryResults = new OptimisticQueryResults();
    this.addOnTransitionHandler((transition) => {
      onTransition(transition.queries.map((q) => q.token));
    });
    this._nextRequestId = 0;
    this._sessionId = newSessionId();

    const { unsavedChangesWarning } = options;
    if (
      typeof window === "undefined" ||
      typeof window.addEventListener === "undefined"
    ) {
      if (unsavedChangesWarning === true) {
        throw new Error(
          "unsavedChangesWarning requested, but window.addEventListener not found! Remove {unsavedChangesWarning: true} from Convex client options.",
        );
      }
    } else if (unsavedChangesWarning !== false) {
      // Listen for tab close events and notify the user on unsaved changes.
      window.addEventListener("beforeunload", (e) => {
        if (this.requestManager.hasIncompleteRequests()) {
          // There are 3 different ways to trigger this pop up so just try all of
          // them.

          e.preventDefault();
          // This confirmation message doesn't actually appear in most modern
          // browsers but we tried.
          const confirmationMessage =
            "Are you sure you want to leave? Your changes may not be saved.";
          // Recommended method for legacy (IE) browsers.
          // casts to avoid deprecation notices
          ((e || (window as any).event) as any).returnValue =
            confirmationMessage;
          return confirmationMessage;
        }
      });
    }

    this.webSocketManager = new WebSocketManager(
      wsUri,
      {
        onOpen: (reconnectMetadata: ReconnectMetadata) => {
          // We have a new WebSocket!
          this.mark("convexWebSocketOpen");
          this.webSocketManager.sendMessage({
            ...reconnectMetadata,
            type: "Connect",
            sessionId: this._sessionId,
            maxObservedTimestamp: this.maxObservedTimestamp,
          });

          // Throw out our remote query, reissue queries
          // and outstanding mutations, and reauthenticate.
          const oldRemoteQueryResults = new Set(
            this.remoteQuerySet.remoteQueryResults().keys(),
          );
          this.remoteQuerySet = new RemoteQuerySet(
            (queryId) => this.state.queryPath(queryId),
            this.logger,
          );
          const [querySetModification, authModification] = this.state.restart(
            oldRemoteQueryResults,
          );
          if (authModification) {
            this.webSocketManager.sendMessage(authModification);
          }
          this.webSocketManager.sendMessage(querySetModification);
          for (const message of this.requestManager.restart()) {
            this.webSocketManager.sendMessage(message);
          }
        },
        onResume: () => {
          const [querySetModification, authModification] = this.state.resume();
          if (authModification) {
            this.webSocketManager.sendMessage(authModification);
          }
          if (querySetModification) {
            this.webSocketManager.sendMessage(querySetModification);
          }
          for (const message of this.requestManager.resume()) {
            this.webSocketManager.sendMessage(message);
          }
        },
        onMessage: (serverMessage: ServerMessage) => {
          // Metrics events grow linearly with reconnection attempts so this
          // conditional prevents n^2 metrics reporting.
          if (!this.firstMessageReceived) {
            this.firstMessageReceived = true;
            this.mark("convexFirstMessageReceived");
            this.reportMarks();
          }
          switch (serverMessage.type) {
            case "Transition": {
              this.observedTimestamp(serverMessage.endVersion.ts);
              this.authenticationManager.onTransition(serverMessage);
              this.remoteQuerySet.transition(serverMessage);
              this.state.transition(serverMessage);
              const completedRequests = this.requestManager.removeCompleted(
                this.remoteQuerySet.timestamp(),
              );
              this.notifyOnQueryResultChanges(completedRequests);
              break;
            }
            case "MutationResponse": {
              if (serverMessage.success) {
                this.observedTimestamp(serverMessage.ts);
              }
              const completedMutationInfo =
                this.requestManager.onResponse(serverMessage);
              if (completedMutationInfo !== null) {
                this.notifyOnQueryResultChanges(
                  new Map([
                    [
                      completedMutationInfo.requestId,
                      completedMutationInfo.result,
                    ],
                  ]),
                );
              }
              break;
            }
            case "ActionResponse": {
              this.requestManager.onResponse(serverMessage);
              break;
            }
            case "AuthError": {
              this.authenticationManager.onAuthError(serverMessage);
              break;
            }
            case "FatalError": {
              const error = logFatalError(this.logger, serverMessage.error);
              void this.webSocketManager.terminate();
              throw error;
            }
            default: {
              serverMessage satisfies never;
            }
          }

          return {
            hasSyncedPastLastReconnect: this.hasSyncedPastLastReconnect(),
          };
        },
        onServerDisconnectError: options.onServerDisconnectError,
      },
      webSocketConstructor,
      this.logger,
      this.markConnectionStateDirty,
      this.debug,
    );
    this.mark("convexClientConstructed");

    // Begin client in a paused state waiting for an auth token.
    if (options.expectAuth) {
      pauseSocket();
    }
  }

  /**
   * Return true if there is outstanding work from prior to the time of the most recent restart.
   * This indicates that the client has not proven itself to have gotten past the issue that
   * potentially led to the restart. Use this to influence when to reset backoff after a failure.
   */
  private hasSyncedPastLastReconnect() {
    const hasSyncedPastLastReconnect =
      this.requestManager.hasSyncedPastLastReconnect() ||
      this.state.hasSyncedPastLastReconnect();
    return hasSyncedPastLastReconnect;
  }

  private observedTimestamp(observedTs: TS) {
    if (
      this.maxObservedTimestamp === undefined ||
      this.maxObservedTimestamp.lessThanOrEqual(observedTs)
    ) {
      this.maxObservedTimestamp = observedTs;
    }
  }

  getMaxObservedTimestamp() {
    return this.maxObservedTimestamp;
  }

  /**
   * Compute the current query results based on the remoteQuerySet and the
   * current optimistic updates and call `onTransition` for all the changed
   * queries.
   *
   * @param completedMutations - A set of mutation IDs whose optimistic updates
   * are no longer needed.
   */
  private notifyOnQueryResultChanges(
    completedRequests: Map<RequestId, FunctionResult>,
  ) {
    const remoteQueryResults: Map<QueryId, FunctionResult> =
      this.remoteQuerySet.remoteQueryResults();
    const queryTokenToValue: QueryResultsMap = new Map();
    for (const [queryId, result] of remoteQueryResults) {
      const queryToken = this.state.queryToken(queryId);
      // It's possible that we've already unsubscribed to this query but
      // the server hasn't learned about that yet. If so, ignore this one.

      if (queryToken !== null) {
        const query = {
          result,
          udfPath: this.state.queryPath(queryId)!,
          args: this.state.queryArgs(queryId)!,
        };
        queryTokenToValue.set(queryToken, query);
      }
    }

    // Query tokens that are new (because of new server results or new local optimistic updates)
    // or differ from old values (because of changes from local optimistic updates or new results
    // from the server).
    const changedQueryTokens =
      this.optimisticQueryResults.ingestQueryResultsFromServer(
        queryTokenToValue,
        new Set(completedRequests.keys()),
      );

    this.handleTransition({
      queries: changedQueryTokens.map((token) => {
        const optimisticResult =
          this.optimisticQueryResults.rawQueryResult(token);
        return {
          token,
          modification: {
            kind: "Updated",
            result: optimisticResult!.result,
          },
        };
      }),
      reflectedMutations: Array.from(completedRequests).map(
        ([requestId, result]) => ({
          requestId,
          result,
        }),
      ),
      timestamp: this.remoteQuerySet.timestamp(),
    });
  }

  private handleTransition(transition: Transition) {
    for (const fn of this._onTransitionFns.values()) {
      fn(transition);
    }
  }

  /**
   * Add a handler that will be called on a transition.
   *
   * Any external side effects (e.g. setting React state) should be handled here.
   *
   * @param fn
   *
   * @returns
   */
  addOnTransitionHandler(fn: (transition: Transition) => void) {
    const id = this._transitionHandlerCounter++;
    this._onTransitionFns.set(id, fn);
    return () => this._onTransitionFns.delete(id);
  }

  /**
   * Get the current JWT auth token and decoded claims.
   */
  getCurrentAuthClaims():
    | { token: string; decoded: Record<string, any> }
    | undefined {
    const authToken = this.state.getAuth();
    let decoded: Record<string, any> = {};
    if (authToken && authToken.tokenType === "User") {
      try {
        decoded = authToken ? jwtDecode(authToken.value) : {};
      } catch {
        decoded = {};
      }
    } else {
      return undefined;
    }
    return { token: authToken.value, decoded };
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
    onChange: (isAuthenticated: boolean) => void,
  ) {
    void this.authenticationManager.setConfig(fetchToken, onChange);
  }

  hasAuth() {
    return this.state.hasAuth();
  }

  /** @internal */
  setAdminAuth(value: string, fakeUserIdentity?: UserIdentityAttributes) {
    const message = this.state.setAdminAuth(value, fakeUserIdentity);
    this.webSocketManager.sendMessage(message);
  }

  clearAuth() {
    const message = this.state.clearAuth();
    this.webSocketManager.sendMessage(message);
  }

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
  subscribe(
    name: string,
    args?: Record<string, Value>,
    options?: SubscribeOptions,
  ): { queryToken: QueryToken; unsubscribe: () => void } {
    const argsObject = parseArgs(args);

    const { modification, queryToken, unsubscribe } = this.state.subscribe(
      name,
      argsObject,
      options?.journal,
      options?.componentPath,
    );
    if (modification !== null) {
      this.webSocketManager.sendMessage(modification);
    }
    return {
      queryToken,
      unsubscribe: () => {
        const modification = unsubscribe();
        if (modification) {
          this.webSocketManager.sendMessage(modification);
        }
      },
    };
  }

  /**
   * A query result based only on the current, local state.
   *
   * The only way this will return a value is if we're already subscribed to the
   * query or its value has been set optimistically.
   */
  localQueryResult(
    udfPath: string,
    args?: Record<string, Value>,
  ): Value | undefined {
    const argsObject = parseArgs(args);
    const queryToken = serializePathAndArgs(udfPath, argsObject);
    return this.optimisticQueryResults.queryResult(queryToken);
  }

  /**
   * Get query result by query token based on current, local state
   *
   * The only way this will return a value is if we're already subscribed to the
   * query or its value has been set optimistically.
   *
   * @internal
   */
  localQueryResultByToken(queryToken: QueryToken): Value | undefined {
    return this.optimisticQueryResults.queryResult(queryToken);
  }

  /**
   * Whether local query result is available for a toke.
   *
   * This method does not throw if the result is an error.
   *
   * @internal
   */
  hasLocalQueryResultByToken(queryToken: QueryToken): boolean {
    return this.optimisticQueryResults.hasQueryResult(queryToken);
  }

  /**
   * @internal
   */
  localQueryLogs(
    udfPath: string,
    args?: Record<string, Value>,
  ): string[] | undefined {
    const argsObject = parseArgs(args);
    const queryToken = serializePathAndArgs(udfPath, argsObject);
    return this.optimisticQueryResults.queryLogs(queryToken);
  }

  /**
   * Retrieve the current {@link QueryJournal} for this query function.
   *
   * If we have not yet received a result for this query, this will be `undefined`.
   *
   * @param name - The name of the query.
   * @param args - The arguments object for this query.
   * @returns The query's {@link QueryJournal} or `undefined`.
   */
  queryJournal(
    name: string,
    args?: Record<string, Value>,
  ): QueryJournal | undefined {
    const argsObject = parseArgs(args);
    const queryToken = serializePathAndArgs(name, argsObject);
    return this.state.queryJournal(queryToken);
  }

  /**
   * Get the current {@link ConnectionState} between the client and the Convex
   * backend.
   *
   * @returns The {@link ConnectionState} with the Convex backend.
   */
  connectionState(): ConnectionState {
    const wsConnectionState = this.webSocketManager.connectionState();
    return {
      hasInflightRequests: this.requestManager.hasInflightRequests(),
      isWebSocketConnected: wsConnectionState.isConnected,
      hasEverConnected: wsConnectionState.hasEverConnected,
      connectionCount: wsConnectionState.connectionCount,
      connectionRetries: wsConnectionState.connectionRetries,
      timeOfOldestInflightRequest:
        this.requestManager.timeOfOldestInflightRequest(),
      inflightMutations: this.requestManager.inflightMutations(),
      inflightActions: this.requestManager.inflightActions(),
    };
  }

  /**
   * Call this whenever the connection state may have changed in a way that could
   * require publishing it. Schedules a possibly update.
   */
  private markConnectionStateDirty = () => {
    void Promise.resolve().then(() => {
      const curConnectionState = this.connectionState();
      if (
        JSON.stringify(curConnectionState) !==
        JSON.stringify(this._lastPublishedConnectionState)
      ) {
        this._lastPublishedConnectionState = curConnectionState;
        for (const cb of this.connectionStateSubscribers.values()) {
          // One of these callback throwing will prevent other callbacks
          // from running but will not leave the client in a undefined state.
          cb(curConnectionState);
        }
      }
    });
  };

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
    const id = this.nextConnectionStateSubscriberId++;
    this.connectionStateSubscribers.set(id, cb);
    return () => {
      this.connectionStateSubscribers.delete(id);
    };
  }

  /**
   * Execute a mutation function.
   *
   * @param name - The name of the mutation.
   * @param args - An arguments object for the mutation. If this is omitted,
   * the arguments will be `{}`.
   * @param options - A {@link MutationOptions} options object for this mutation.

   * @returns - A promise of the mutation's result.
   */
  async mutation(
    name: string,
    args?: Record<string, Value>,
    options?: MutationOptions,
  ): Promise<any> {
    const result = await this.mutationInternal(name, args, options);
    if (!result.success) {
      if (result.errorData !== undefined) {
        throw forwardData(
          result,
          new ConvexError(
            createHybridErrorStacktrace("mutation", name, result),
          ),
        );
      }
      throw new Error(createHybridErrorStacktrace("mutation", name, result));
    }
    return result.value;
  }

  /**
   * @internal
   */
  async mutationInternal(
    udfPath: string,
    args?: Record<string, Value>,
    options?: MutationOptions,
    componentPath?: string,
  ): Promise<FunctionResult> {
    const { mutationPromise } = this.enqueueMutation(
      udfPath,
      args,
      options,
      componentPath,
    );
    return mutationPromise;
  }

  /**
   * @internal
   */
  enqueueMutation(
    udfPath: string,
    args?: Record<string, Value>,
    options?: MutationOptions,
    componentPath?: string,
  ): { requestId: RequestId; mutationPromise: Promise<FunctionResult> } {
    const mutationArgs = parseArgs(args);
    this.tryReportLongDisconnect();
    const requestId = this.nextRequestId;
    this._nextRequestId++;

    if (options !== undefined) {
      const optimisticUpdate = options.optimisticUpdate;
      if (optimisticUpdate !== undefined) {
        const wrappedUpdate = (localQueryStore: OptimisticLocalStore) => {
          const result: unknown = optimisticUpdate(
            localQueryStore,
            mutationArgs,
          );
          if (result instanceof Promise) {
            this.logger.warn(
              "Optimistic update handler returned a Promise. Optimistic updates should be synchronous.",
            );
          }
        };

        const changedQueryTokens =
          this.optimisticQueryResults.applyOptimisticUpdate(
            wrappedUpdate,
            requestId,
          );

        const changedQueries = changedQueryTokens.map((token) => {
          const localResult = this.localQueryResultByToken(token);
          return {
            token,
            modification: {
              kind: "Updated" as const,
              result:
                localResult === undefined
                  ? undefined
                  : {
                      success: true as const,
                      value: localResult,
                      logLines: [],
                    },
            },
          };
        });
        this.handleTransition({
          queries: changedQueries,
          reflectedMutations: [],
          timestamp: this.remoteQuerySet.timestamp(),
        });
      }
    }

    const message: MutationRequest = {
      type: "Mutation",
      requestId,
      udfPath,
      componentPath,
      args: [convexToJson(mutationArgs)],
    };
    const mightBeSent = this.webSocketManager.sendMessage(message);
    const mutationPromise = this.requestManager.request(message, mightBeSent);
    return {
      requestId,
      mutationPromise,
    };
  }

  /**
   * Execute an action function.
   *
   * @param name - The name of the action.
   * @param args - An arguments object for the action. If this is omitted,
   * the arguments will be `{}`.
   * @returns A promise of the action's result.
   */
  async action(name: string, args?: Record<string, Value>): Promise<any> {
    const result = await this.actionInternal(name, args);
    if (!result.success) {
      if (result.errorData !== undefined) {
        throw forwardData(
          result,
          new ConvexError(createHybridErrorStacktrace("action", name, result)),
        );
      }
      throw new Error(createHybridErrorStacktrace("action", name, result));
    }
    return result.value;
  }

  /**
   * @internal
   */
  async actionInternal(
    udfPath: string,
    args?: Record<string, Value>,
    componentPath?: string,
  ): Promise<FunctionResult> {
    const actionArgs = parseArgs(args);
    const requestId = this.nextRequestId;
    this._nextRequestId++;
    this.tryReportLongDisconnect();

    const message: ActionRequest = {
      type: "Action",
      requestId,
      udfPath,
      componentPath,
      args: [convexToJson(actionArgs)],
    };

    const mightBeSent = this.webSocketManager.sendMessage(message);
    return this.requestManager.request(message, mightBeSent);
  }

  /**
   * Close any network handles associated with this client and stop all subscriptions.
   *
   * Call this method when you're done with an {@link BaseConvexClient} to
   * dispose of its sockets and resources.
   *
   * @returns A `Promise` fulfilled when the connection has been completely closed.
   */
  async close(): Promise<void> {
    this.authenticationManager.stop();
    return this.webSocketManager.terminate();
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
   * @internal
   */
  get nextRequestId() {
    return this._nextRequestId;
  }

  /**
   * @internal
   */
  get sessionId() {
    return this._sessionId;
  }

  // Instance property so that `mark()` doesn't need to be called as a method.
  private mark = (name: MarkName) => {
    if (this.debug) {
      mark(name, this.sessionId);
    }
  };

  /**
   * Reports performance marks to the server. This should only be called when
   * we have a functional websocket.
   */
  private reportMarks() {
    if (this.debug) {
      const report = getMarksReport(this.sessionId);
      this.webSocketManager.sendMessage({
        type: "Event",
        eventType: "ClientConnect",
        event: report,
      });
    }
  }

  private tryReportLongDisconnect() {
    if (!this.debug) {
      return;
    }
    const timeOfOldestRequest =
      this.connectionState().timeOfOldestInflightRequest;
    if (
      timeOfOldestRequest === null ||
      Date.now() - timeOfOldestRequest.getTime() <= 60 * 1000
    ) {
      return;
    }
    const endpoint = `${this.address}/api/debug_event`;
    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Convex-Client": `npm-${version}`,
      },
      body: JSON.stringify({ event: "LongWebsocketDisconnect" }),
    })
      .then((response) => {
        if (!response.ok) {
          this.logger.warn(
            "Analytics request failed with response:",
            response.body,
          );
        }
      })
      .catch((error) => {
        this.logger.warn("Analytics response failed with error:", error);
      });
  }
}
