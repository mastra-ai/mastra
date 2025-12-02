import { FunctionReference, FunctionReturnType, OptionalRestArgs } from "../server/api.js";
import { Logger } from "./logging.js";
import { ArgsAndOptions } from "../server/index.js";
export declare const STATUS_CODE_OK = 200;
export declare const STATUS_CODE_BAD_REQUEST = 400;
export declare const STATUS_CODE_UDF_FAILED = 560;
export declare function setFetch(f: typeof globalThis.fetch): void;
export type HttpMutationOptions = {
    /**
     * Skip the default queue of mutations and run this immediately.
     *
     * This allows the same HttpConvexClient to be used to request multiple
     * mutations in parallel, something not possible with WebSocket-based clients.
     */
    skipQueue: boolean;
};
/**
 * A Convex client that runs queries and mutations over HTTP.
 *
 * This client is stateful (it has user credentials and queues mutations)
 * so take care to avoid sharing it between requests in a server.
 *
 * This is appropriate for server-side code (like Netlify Lambdas) or non-reactive
 * webapps.
 *
 * @public
 */
export declare class ConvexHttpClient {
    private readonly address;
    private auth;
    private adminAuth;
    private encodedTsPromise?;
    private debug;
    private fetchOptions?;
    private logger;
    private mutationQueue;
    private isProcessingQueue;
    /**
     * Create a new {@link ConvexHttpClient}.
     *
     * @param address - The url of your Convex deployment, often provided
     * by an environment variable. E.g. `https://small-mouse-123.convex.cloud`.
     * @param options - An object of options.
     * - `skipConvexDeploymentUrlCheck` - Skip validating that the Convex deployment URL looks like
     * `https://happy-animal-123.convex.cloud` or localhost. This can be useful if running a self-hosted
     * Convex backend that uses a different URL.
     * - `logger` - A logger or a boolean. If not provided, logs to the console.
     * You can construct your own logger to customize logging to log elsewhere
     * or not log at all, or use `false` as a shorthand for a no-op logger.
     * A logger is an object with 4 methods: log(), warn(), error(), and logVerbose().
     * These methods can receive multiple arguments of any types, like console.log().
     * - `auth` - A JWT containing identity claims accessible in Convex functions.
     * This identity may expire so it may be necessary to call `setAuth()` later,
     * but for short-lived clients it's convenient to specify this value here.
     */
    constructor(address: string, options?: {
        skipConvexDeploymentUrlCheck?: boolean;
        logger?: Logger | boolean;
        auth?: string;
    });
    /**
     * Obtain the {@link ConvexHttpClient}'s URL to its backend.
     * @deprecated Use url, which returns the url without /api at the end.
     *
     * @returns The URL to the Convex backend, including the client's API version.
     */
    backendUrl(): string;
    /**
     * Return the address for this client, useful for creating a new client.
     *
     * Not guaranteed to match the address with which this client was constructed:
     * it may be canonicalized.
     */
    get url(): string;
    /**
     * Set the authentication token to be used for subsequent queries and mutations.
     *
     * Should be called whenever the token changes (i.e. due to expiration and refresh).
     *
     * @param value - JWT-encoded OpenID Connect identity token.
     */
    setAuth(value: string): void;
    /**
     * Clear the current authentication token if set.
     */
    clearAuth(): void;
    /**
     * This API is experimental: it may change or disappear.
     *
     * Execute a Convex query function at the same timestamp as every other
     * consistent query execution run by this HTTP client.
     *
     * This doesn't make sense for long-lived ConvexHttpClients as Convex
     * backends can read a limited amount into the past: beyond 30 seconds
     * in the past may not be available.
     *
     * Create a new client to use a consistent time.
     *
     * @param name - The name of the query.
     * @param args - The arguments object for the query. If this is omitted,
     * the arguments will be `{}`.
     * @returns A promise of the query's result.
     *
     * @deprecated This API is experimental: it may change or disappear.
     */
    consistentQuery<Query extends FunctionReference<"query">>(query: Query, ...args: OptionalRestArgs<Query>): Promise<FunctionReturnType<Query>>;
    private getTimestamp;
    private getTimestampInner;
    /**
     * Execute a Convex query function.
     *
     * @param name - The name of the query.
     * @param args - The arguments object for the query. If this is omitted,
     * the arguments will be `{}`.
     * @returns A promise of the query's result.
     */
    query<Query extends FunctionReference<"query">>(query: Query, ...args: OptionalRestArgs<Query>): Promise<FunctionReturnType<Query>>;
    private queryInner;
    private mutationInner;
    private processMutationQueue;
    private enqueueMutation;
    /**
     * Execute a Convex mutation function. Mutations are queued by default.
     *
     * @param name - The name of the mutation.
     * @param args - The arguments object for the mutation. If this is omitted,
     * the arguments will be `{}`.
     * @param options - An optional object containing
     * @returns A promise of the mutation's result.
     */
    mutation<Mutation extends FunctionReference<"mutation">>(mutation: Mutation, ...args: ArgsAndOptions<Mutation, HttpMutationOptions>): Promise<FunctionReturnType<Mutation>>;
    /**
     * Execute a Convex action function. Actions are not queued.
     *
     * @param name - The name of the action.
     * @param args - The arguments object for the action. If this is omitted,
     * the arguments will be `{}`.
     * @returns A promise of the action's result.
     */
    action<Action extends FunctionReference<"action">>(action: Action, ...args: OptionalRestArgs<Action>): Promise<FunctionReturnType<Action>>;
}
//# sourceMappingURL=http_client.d.ts.map