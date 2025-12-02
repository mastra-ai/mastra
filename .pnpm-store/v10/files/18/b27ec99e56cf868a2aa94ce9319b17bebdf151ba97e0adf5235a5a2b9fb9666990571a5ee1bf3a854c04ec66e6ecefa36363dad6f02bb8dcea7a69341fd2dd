import {
  HttpClient,
  Redis,
  VERSION,
  error_exports
} from "./chunk-TAJI6TAE.mjs";

// platforms/fastly.ts
var Redis2 = class extends Redis {
  /**
   * Create a new redis client
   *
   * @example
   * ```typescript
   *    const redis = new Redis({
   *        url: "<UPSTASH_REDIS_REST_URL>",
   *        token: "<UPSTASH_REDIS_REST_TOKEN>",
   *        backend: "upstash-db",
   *    });
   * ```
   */
  constructor(config) {
    if (!config.url) {
      console.warn(
        `[Upstash Redis] The 'url' property is missing or undefined in your Redis config.`
      );
    } else if (config.url.startsWith(" ") || config.url.endsWith(" ") || /\r|\n/.test(config.url)) {
      console.warn(
        "[Upstash Redis] The redis url contains whitespace or newline, which can cause errors!"
      );
    }
    if (!config.token) {
      console.warn(
        `[Upstash Redis] The 'token' property is missing or undefined in your Redis config.`
      );
    } else if (config.token.startsWith(" ") || config.token.endsWith(" ") || /\r|\n/.test(config.token)) {
      console.warn(
        "[Upstash Redis] The redis token contains whitespace or newline, which can cause errors!"
      );
    }
    const client = new HttpClient({
      baseUrl: config.url,
      retry: config.retry,
      headers: { authorization: `Bearer ${config.token}` },
      options: { backend: config.backend },
      responseEncoding: config.responseEncoding,
      keepAlive: config.keepAlive,
      readYourWrites: config.readYourWrites
    });
    super(client, {
      automaticDeserialization: config.automaticDeserialization,
      enableAutoPipelining: config.enableAutoPipelining
    });
    this.addTelemetry({
      sdk: `@upstash/redis@${VERSION}`,
      platform: "fastly"
    });
    if (this.enableAutoPipelining) {
      return this.autoPipeline();
    }
  }
};
export {
  Redis2 as Redis,
  error_exports as errors
};
