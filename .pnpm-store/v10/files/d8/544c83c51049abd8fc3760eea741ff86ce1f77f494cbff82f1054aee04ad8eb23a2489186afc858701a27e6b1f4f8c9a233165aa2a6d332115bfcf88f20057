import {
  FusionAlgorithm,
  HttpClient,
  Index,
  QueryMode,
  VERSION,
  WeightingStrategy
} from "./chunk-MQ3XJEJ2.mjs";

// src/utils/get-runtime.ts
function getRuntime() {
  if (typeof process === "object" && typeof process.versions == "object" && process.versions.bun)
    return `bun@${process.versions.bun}`;
  return typeof EdgeRuntime === "string" ? "edge-light" : `node@${process.version}`;
}

// src/platforms/nodejs.ts
var Index2 = class _Index extends Index {
  constructor(configOrRequester) {
    if (configOrRequester !== void 0 && "request" in configOrRequester) {
      super(configOrRequester);
      return;
    }
    const token = configOrRequester?.token ?? process.env.NEXT_PUBLIC_UPSTASH_VECTOR_REST_TOKEN ?? process.env.UPSTASH_VECTOR_REST_TOKEN;
    const url = configOrRequester?.url ?? process.env.NEXT_PUBLIC_UPSTASH_VECTOR_REST_URL ?? process.env.UPSTASH_VECTOR_REST_URL;
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
    const enableTelemetry = process.env.UPSTASH_DISABLE_TELEMETRY ? false : configOrRequester?.enableTelemetry ?? true;
    const telemetryHeaders = enableTelemetry ? {
      "Upstash-Telemetry-Sdk": `upstash-vector-js@${VERSION}`,
      "Upstash-Telemetry-Platform": process.env.VERCEL ? "vercel" : process.env.AWS_REGION ? "aws" : "unknown",
      "Upstash-Telemetry-Runtime": getRuntime()
    } : {};
    const client = new HttpClient({
      baseUrl: url,
      retry: configOrRequester?.retry,
      headers: { authorization: `Bearer ${token}`, ...telemetryHeaders },
      cache: configOrRequester?.cache === false ? void 0 : configOrRequester?.cache || "no-store",
      signal: configOrRequester?.signal
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
    const url = env?.UPSTASH_VECTOR_REST_URL || process?.env.UPSTASH_VECTOR_REST_URL;
    const token = env?.UPSTASH_VECTOR_REST_TOKEN || process?.env.UPSTASH_VECTOR_REST_TOKEN;
    if (!url) {
      throw new Error("Unable to find environment variable: `UPSTASH_VECTOR_REST_URL`");
    }
    if (!token) {
      throw new Error("Unable to find environment variable: `UPSTASH_VECTOR_REST_TOKEN`");
    }
    return new _Index({ ...config, url, token });
  }
};
export {
  FusionAlgorithm,
  Index2 as Index,
  QueryMode,
  WeightingStrategy
};
