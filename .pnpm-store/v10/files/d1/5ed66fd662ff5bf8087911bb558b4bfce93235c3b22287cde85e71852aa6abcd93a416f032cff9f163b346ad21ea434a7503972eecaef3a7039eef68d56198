import { HTTPClient } from "./http.js";
import { Logger } from "./logger.js";
import { RetryConfig } from "./retries.js";
/**
 * Production server
 */
export declare const ServerProduction = "production";
/**
 * Contains the list of servers available to the SDK
 */
export declare const ServerList: {
    readonly production: "https://openrouter.ai/api/v1";
};
export type SDKOptions = {
    apiKey?: string | (() => Promise<string>) | undefined;
    /**
     * Allows setting the httpReferer parameter for all supported operations
     */
    httpReferer?: string | undefined;
    /**
     * Allows setting the xTitle parameter for all supported operations
     */
    xTitle?: string | undefined;
    httpClient?: HTTPClient;
    /**
     * Allows overriding the default server used by the SDK
     */
    server?: keyof typeof ServerList | undefined;
    /**
     * Allows overriding the default server URL used by the SDK
     */
    serverURL?: string | undefined;
    /**
     * Allows overriding the default user agent used by the SDK
     */
    userAgent?: string | undefined;
    /**
     * Allows overriding the default retry config used by the SDK
     */
    retryConfig?: RetryConfig;
    timeoutMs?: number;
    debugLogger?: Logger;
};
export declare function serverURLFromOptions(options: SDKOptions): URL | null;
export declare const SDK_METADATA: {
    readonly language: "typescript";
    readonly openapiDocVersion: "1.0.0";
    readonly sdkVersion: "0.1.27";
    readonly genVersion: "2.760.2";
    readonly userAgent: "speakeasy-sdk/typescript 0.1.27 2.760.2 1.0.0 @openrouter/sdk";
};
//# sourceMappingURL=config.d.ts.map