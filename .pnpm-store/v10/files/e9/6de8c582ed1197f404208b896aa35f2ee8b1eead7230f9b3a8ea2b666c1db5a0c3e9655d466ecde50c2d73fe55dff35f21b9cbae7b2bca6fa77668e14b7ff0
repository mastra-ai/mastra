import { H as HttpClientConfig, R as RequesterConfig, D as Dict, I as Index$1, a as Requester } from './vector-7jBuY6ad.js';
export { d as FetchResult, F as FusionAlgorithm, f as InfoResult, Q as QueryMode, e as QueryResult, c as RangeResult, S as SparseVector, U as UpstashRequest, b as UpstashResponse, V as Vector, W as WeightingStrategy } from './vector-7jBuY6ad.js';

/**
 * Connection credentials for upstash vector.
 * Get them from https://console.upstash.com/vector/<uuid>
 */
type IndexConfig = {
    /**
     * UPSTASH_VECTOR_REST_URL
     */
    url?: string;
    /**
     * UPSTASH_VECTOR_REST_TOKEN
     */
    token?: string;
    /**
     * The signal will allow aborting requests on the fly.
     * For more check: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
     */
    signal?: HttpClientConfig["signal"];
    /**
     * Enable telemetry to help us improve the SDK.
     * The sdk will send the sdk version, platform and node version as telemetry headers.
     *
     * @default true
     */
    enableTelemetry?: boolean;
} & RequesterConfig;
/**
 * Serverless vector client for upstash.
 */
declare class Index<TIndexMetadata extends Dict = Dict> extends Index$1<TIndexMetadata> {
    /**
     * Create a new vector client by providing the url and token
     *
     * @example
     * ```typescript
     * const index = new Index({
     *  url: "<UPSTASH_VECTOR_REST_URL>",
     *  token: "<UPSTASH_VECTOR_REST_TOKEN>",
     * });
     * ```
     * OR
     * This will automatically get environment variables from .env file
     * ```typescript
     * const index = new Index();
     * ```
     */
    constructor(config?: IndexConfig);
    /**
     * Create a new vector client by providing a custom `Requester` implementation
     *
     * @example
     * ```ts
     *
     * import { UpstashRequest, Requester, UpstashResponse, vector } from "@upstash/vector"
     *
     *  const requester: Requester = {
     *    request: <TResult>(req: UpstashRequest): Promise<UpstashResponse<TResult>> => {
     *      // ...
     *    }
     *  }
     *
     * const vector = new vector(requester)
     * ```
     */
    constructor(requesters?: Requester);
    /**
     * Create a new Upstash Vector instance from environment variables.
     *
     * Use this to automatically load connection secrets from your environment
     * variables. For instance when using the Vercel integration.
     *
     * When used on the Cloudflare Workers, you can just pass the "env" context provided by Cloudflare.
     * Else, this tries to load `UPSTASH_VECTOR_REST_URL` and `UPSTASH_VECTOR_REST_TOKEN` from
     * your environment using `process.env`.
     */
    static fromEnv(env?: {
        UPSTASH_VECTOR_REST_URL: string;
        UPSTASH_VECTOR_REST_TOKEN: string;
    }, config?: Omit<IndexConfig, "url" | "token">): Index;
}

export { Index, type IndexConfig, Requester };
