import type { OptimisticUpdate } from "../browser/index.js";
import React from "react";
import { Value } from "../values/index.js";
import { QueryJournal } from "../browser/sync/protocol.js";
import { AuthTokenFetcher, BaseConvexClientOptions, ConnectionState } from "../browser/sync/client.js";
import { ArgsAndOptions, FunctionArgs, FunctionReference, FunctionReturnType, OptionalRestArgs } from "../server/api.js";
import { EmptyObject } from "../server/registration.js";
import { Logger } from "../browser/logging.js";
import { ConvexQueryOptions } from "../browser/query_options.js";
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
    withOptimisticUpdate<T extends OptimisticUpdate<FunctionArgs<Mutation>>>(optimisticUpdate: T & (ReturnType<T> extends Promise<any> ? "Optimistic update handlers must be synchronous" : {})): ReactMutation<Mutation>;
}
export declare function createMutation(mutationReference: FunctionReference<"mutation">, client: ConvexReactClient, update?: OptimisticUpdate<any>): ReactMutation<any>;
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
export interface ConvexReactClientOptions extends BaseConvexClientOptions {
}
/**
 * A Convex client for use within React.
 *
 * This loads reactive queries and executes mutations over a WebSocket.
 *
 * @public
 */
export declare class ConvexReactClient {
    private address;
    private cachedSync?;
    private listeners;
    private options;
    private closed;
    private _logger;
    private adminAuth?;
    private fakeUserIdentity?;
    /**
     * @param address - The url of your Convex deployment, often provided
     * by an environment variable. E.g. `https://small-mouse-123.convex.cloud`.
     * @param options - See {@link ConvexReactClientOptions} for a full description.
     */
    constructor(address: string, options?: ConvexReactClientOptions);
    /**
     * Return the address for this client, useful for creating a new client.
     *
     * Not guaranteed to match the address with which this client was constructed:
     * it may be canonicalized.
     */
    get url(): string;
    /**
     * Set the authentication token to be used for subsequent queries and mutations.
     * `fetchToken` will be called automatically again if a token expires.
     * `fetchToken` should return `null` if the token cannot be retrieved, for example
     * when the user's rights were permanently revoked.
     * @param fetchToken - an async function returning the JWT-encoded OpenID Connect Identity Token
     * @param onChange - a callback that will be called when the authentication status changes
     */
    setAuth(fetchToken: AuthTokenFetcher, onChange?: (isAuthenticated: boolean) => void): void;
    /**
     * Clear the current authentication token if set.
     */
    clearAuth(): void;
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
    watchQuery<Query extends FunctionReference<"query">>(query: Query, ...argsAndOptions: ArgsAndOptions<Query, WatchQueryOptions>): Watch<FunctionReturnType<Query>>;
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
    prewarmQuery<Query extends FunctionReference<"query">>(queryOptions: ConvexQueryOptions<Query> & {
        extendSubscriptionFor?: number;
    }): void;
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
    mutation<Mutation extends FunctionReference<"mutation">>(mutation: Mutation, ...argsAndOptions: ArgsAndOptions<Mutation, MutationOptions<FunctionArgs<Mutation>>>): Promise<FunctionReturnType<Mutation>>;
    /**
     * Execute an action function.
     *
     * @param action - A {@link server.FunctionReference} for the public action
     * to run.
     * @param args - An arguments object for the action. If this is omitted,
     * the arguments will be `{}`.
     * @returns A promise of the action's result.
     */
    action<Action extends FunctionReference<"action">>(action: Action, ...args: OptionalRestArgs<Action>): Promise<FunctionReturnType<Action>>;
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
    query<Query extends FunctionReference<"query">>(query: Query, ...args: OptionalRestArgs<Query>): Promise<FunctionReturnType<Query>>;
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
     * ConnectionState may also *lose* properties in future versions as we figure
     * out what information is most useful. As such this API is considered unstable.
     *
     * @returns An unsubscribe function to stop listening.
     */
    subscribeToConnectionState(cb: (connectionState: ConnectionState) => void): () => void;
    /**
     * Get the logger for this client.
     *
     * @returns The {@link Logger} for this client.
     */
    get logger(): Logger;
    /**
     * Close any network handles associated with this client and stop all subscriptions.
     *
     * Call this method when you're done with a {@link ConvexReactClient} to
     * dispose of its sockets and resources.
     *
     * @returns A `Promise` fulfilled when the connection has been completely closed.
     */
    close(): Promise<void>;
    private transition;
}
/**
 * Get the {@link ConvexReactClient} within a React component.
 *
 * This relies on the {@link ConvexProvider} being above in the React component tree.
 *
 * @returns The active {@link ConvexReactClient} object, or `undefined`.
 *
 * @public
 */
export declare function useConvex(): ConvexReactClient;
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
export declare const ConvexProvider: React.FC<{
    client: ConvexReactClient;
    children?: React.ReactNode;
}>;
export type OptionalRestArgsOrSkip<FuncRef extends FunctionReference<any>> = FuncRef["_args"] extends EmptyObject ? [args?: EmptyObject | "skip"] : [args: FuncRef["_args"] | "skip"];
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
export declare function useQuery<Query extends FunctionReference<"query">>(query: Query, ...args: OptionalRestArgsOrSkip<Query>): Query["_returnType"] | undefined;
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
export declare function useMutation<Mutation extends FunctionReference<"mutation">>(mutation: Mutation): ReactMutation<Mutation>;
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
export declare function useAction<Action extends FunctionReference<"action">>(action: Action): ReactAction<Action>;
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
export declare function useConvexConnectionState(): ConnectionState;
//# sourceMappingURL=client.d.ts.map