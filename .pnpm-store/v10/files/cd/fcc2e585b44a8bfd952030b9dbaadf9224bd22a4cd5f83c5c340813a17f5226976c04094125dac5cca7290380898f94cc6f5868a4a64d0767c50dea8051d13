import {
  FusionAlgorithm,
  HttpClient,
  Index,
  QueryMode,
  VERSION,
  WeightingStrategy
} from "./chunk-MQ3XJEJ2.mjs";

// src/platforms/cloudflare.ts
var Index2 = class _Index extends Index {
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
  constructor(config) {
    const safeProcess = typeof process === "undefined" ? {} : process;
    const token = config?.token ?? safeProcess.NEXT_PUBLIC_UPSTASH_VECTOR_REST_TOKEN ?? safeProcess.UPSTASH_VECTOR_REST_TOKEN;
    const url = config?.url ?? safeProcess.NEXT_PUBLIC_UPSTASH_VECTOR_REST_URL ?? safeProcess.UPSTASH_VECTOR_REST_URL;
    if (!token) {
      throw new Error("UPSTASH_VECTOR_REST_TOKEN is missing!");
    }
    if (!url) {
      throw new Error("UPSTASH_VECTOR_REST_URL is missing!");
    }
    if (url.startsWith(" ") || url.endsWith(" ") || /\r|\n/.test(url)) {
      console.warn("The vector url contains whitespace or newline, which can cause errors!");
    }
    if (token.startsWith(" ") || token.endsWith(" ") || /\r|\n/.test(token)) {
      console.warn("The vector token contains whitespace or newline, which can cause errors!");
    }
    const enableTelemetry = safeProcess.UPSTASH_DISABLE_TELEMETRY ? false : config?.enableTelemetry ?? true;
    const telemetryHeaders = enableTelemetry ? {
      "Upstash-Telemetry-Sdk": `upstash-vector-js@${VERSION}`,
      "Upstash-Telemetry-Platform": "cloudflare"
    } : {};
    const client = new HttpClient({
      baseUrl: url,
      retry: config?.retry,
      headers: { authorization: `Bearer ${token}`, ...telemetryHeaders },
      signal: config?.signal,
      cache: config?.cache === false ? void 0 : config?.cache
    });
    super(client);
  }
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
  static fromEnv(env, config) {
    let url;
    let token;
    if (env) {
      url = env.UPSTASH_VECTOR_REST_URL;
      if (!url) {
        throw new Error(
          "Unable to find environment variable: `UPSTASH_VECTOR_REST_URL`. Please add it via `wrangler secret put UPSTASH_VECTOR_REST_URL`"
        );
      }
      token = env.UPSTASH_VECTOR_REST_TOKEN;
      if (!token) {
        throw new Error(
          "Unable to find environment variable: `UPSTASH_VECTOR_REST_TOKEN`. Please add it via `wrangler secret put UPSTASH_VECTOR_REST_TOKEN`"
        );
      }
    }
    return new _Index({
      // @ts-expect-error We don't need to type this in the cf env type
      enableTelemetry: env?.UPSTASH_DISABLE_TELEMETRY ? false : void 0,
      ...config,
      url,
      token
    });
  }
};
export {
  FusionAlgorithm,
  Index2 as Index,
  QueryMode,
  WeightingStrategy
};
