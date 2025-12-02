import { BaseConvexClient, BaseConvexClientOptions, MutationOptions } from "./index.js";
import { FunctionArgs, FunctionReference, FunctionReturnType } from "../server/index.js";
import { AuthTokenFetcher } from "./sync/authentication_manager.js";
import { ConnectionState } from "./sync/client.js";
/** internal */
export declare function setDefaultWebSocketConstructor(ws: typeof WebSocket): void;
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
export declare class ConvexClient {
    private listeners;
    private _client;
    private callNewListenersWithCurrentValuesTimer;
    private _closed;
    private _disabled;
    /**
     * Once closed no registered callbacks will fire again.
     */
    get closed(): boolean;
    get client(): BaseConvexClient;
    get disabled(): boolean;
    /**
     * Construct a client and immediately initiate a WebSocket connection to the passed address.
     *
     * @public
     */
    constructor(address: string, options?: ConvexClientOptions);
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
    onUpdate<Query extends FunctionReference<"query">>(query: Query, args: FunctionArgs<Query>, callback: (result: FunctionReturnType<Query>) => unknown, onError?: (e: Error) => unknown): Unsubscribe<Query["_returnType"]>;
    private callNewListenersWithCurrentValues;
    private queryResultReady;
    close(): Promise<void>;
    /**
     * Get the current JWT auth token and decoded claims.
     */
    getAuth(): {
        token: string;
        decoded: Record<string, any>;
    } | undefined;
    /**
     * Set the authentication token to be used for subsequent queries and mutations.
     * `fetchToken` will be called automatically again if a token expires.
     * `fetchToken` should return `null` if the token cannot be retrieved, for example
     * when the user's rights were permanently revoked.
     * @param fetchToken - an async function returning the JWT (typically an OpenID Connect Identity Token)
     * @param onChange - a callback that will be called when the authentication status changes
     */
    setAuth(fetchToken: AuthTokenFetcher, onChange?: (isAuthenticated: boolean) => void): void;
    /**
     * Execute a mutation function.
     *
     * @param mutation - A {@link server.FunctionReference} for the public mutation
     * to run.
     * @param args - An arguments object for the mutation.
     * @param options - A {@link MutationOptions} options object for the mutation.
     * @returns A promise of the mutation's result.
     */
    mutation<Mutation extends FunctionReference<"mutation">>(mutation: Mutation, args: FunctionArgs<Mutation>, options?: MutationOptions): Promise<Awaited<FunctionReturnType<Mutation>>>;
    /**
     * Execute an action function.
     *
     * @param action - A {@link server.FunctionReference} for the public action
     * to run.
     * @param args - An arguments object for the action.
     * @returns A promise of the action's result.
     */
    action<Action extends FunctionReference<"action">>(action: Action, args: FunctionArgs<Action>): Promise<Awaited<FunctionReturnType<Action>>>;
    /**
     * Fetch a query result once.
     *
     * @param query - A {@link server.FunctionReference} for the public query
     * to run.
     * @param args - An arguments object for the query.
     * @returns A promise of the query's result.
     */
    query<Query extends FunctionReference<"query">>(query: Query, args: Query["_args"]): Promise<Awaited<Query["_returnType"]>>;
    /**
     * Get the current {@link ConnectionState} between the client and the Convex
     * backend.
     *
     * @returns The {@link ConnectionState} with the Convex backend.
     */
    connectionState(): ConnectionState;
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
}
//# sourceMappingURL=simple_client.d.ts.map