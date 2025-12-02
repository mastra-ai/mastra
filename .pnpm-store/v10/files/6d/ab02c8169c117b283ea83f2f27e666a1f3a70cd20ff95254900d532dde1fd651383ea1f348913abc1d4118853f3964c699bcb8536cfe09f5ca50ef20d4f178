import { Abortable } from 'events';
import type { AbortSignal as AbortSignal_2 } from '@cloudflare/workers-types/experimental';
import { Awaitable as Awaitable_2 } from '..';
import type { Blob as Blob_2 } from '@cloudflare/workers-types/experimental';
import { Blob as Blob_3 } from 'buffer';
import { BodyInit } from 'undici';
import type { CacheStorage } from '@cloudflare/workers-types/experimental';
import { cspotcodeSourceMapSupport } from '@cspotcode/source-map-support';
import type { D1Database } from '@cloudflare/workers-types/experimental';
import type { DurableObjectNamespace } from '@cloudflare/workers-types/experimental';
import { ExternalServer as ExternalServer_2 } from '../..';
import { ExternalServer as ExternalServer_3 } from '..';
import type { Fetcher } from '@cloudflare/workers-types/experimental';
import type { File as File_2 } from '@cloudflare/workers-types/experimental';
import { FormData as FormData_2 } from 'undici';
import { Headers as Headers_2 } from 'undici';
import type { Headers as Headers_3 } from '@cloudflare/workers-types/experimental';
import { HeadersInit } from 'undici';
import http from 'http';
import { IncomingMessage } from 'http';
import { IncomingRequestCfProperties } from '@cloudflare/workers-types/experimental';
import { Json as Json_2 } from '..';
import { kCurrentWorker as kCurrentWorker_2 } from './core';
import { kUnsafeEphemeralUniqueKey as kUnsafeEphemeralUniqueKey_2 } from './shared';
import type { KVNamespace } from '@cloudflare/workers-types/experimental';
import type { KVNamespaceListKey } from '@cloudflare/workers-types/experimental';
import { Log as Log_2 } from '..';
import { Miniflare as Miniflare_2 } from '../..';
import { Miniflare as Miniflare_3 } from '..';
import { MockAgent } from 'undici';
import NodeWebSocket from 'ws';
import { ParseParams } from 'zod';
import { PeriodType as PeriodType_2 } from './ratelimit';
import { Plugin as Plugin_2 } from './shared';
import { Process } from '@puppeteer/browsers';
import type { Queue } from '@cloudflare/workers-types/experimental';
import type { R2Bucket } from '@cloudflare/workers-types/experimental';
import { Readable } from 'stream';
import type { ReadableStream as ReadableStream_2 } from '@cloudflare/workers-types/experimental';
import { ReadableStream as ReadableStream_3 } from 'stream/web';
import { ReferrerPolicy } from 'undici';
import { RemoteProxyConnectionString as RemoteProxyConnectionString_2 } from '..';
import { RemoteProxyConnectionString as RemoteProxyConnectionString_3 } from './shared';
import { Request as Request_3 } from '../..';
import { Request as Request_4 } from 'undici';
import type { Request as Request_5 } from '@cloudflare/workers-types/experimental';
import { Request as Request_6 } from '..';
import { RequestCache } from 'undici';
import { RequestCredentials } from 'undici';
import { RequestDestination } from 'undici';
import { RequestDuplex } from 'undici';
import { RequestInfo as RequestInfo_2 } from 'undici';
import { RequestInit as RequestInit_3 } from 'undici';
import type { RequestInit as RequestInit_4 } from '@cloudflare/workers-types/experimental';
import type { RequestInitCfProperties } from '@cloudflare/workers-types/experimental';
import { RequestMode } from 'undici';
import { RequestRedirect } from 'undici';
import { Response as Response_3 } from '../..';
import { Response as Response_4 } from 'undici';
import type { Response as Response_5 } from '@cloudflare/workers-types/experimental';
import { Response as Response_6 } from '..';
import { ResponseInit as ResponseInit_3 } from 'undici';
import { ResponseRedirectStatus } from 'undici';
import { ResponseType } from 'undici';
import { ServerResponse } from 'http';
import type { ServiceWorkerGlobalScope } from '@cloudflare/workers-types/experimental';
import { compatibilityDate as supportedCompatibilityDate } from 'workerd';
import { Transform } from 'stream';
import * as undici from 'undici';
import { URL as URL_2 } from 'url';
import { WorkerRegistry as WorkerRegistry_2 } from '..';
import { z } from 'zod';

export declare class __MiniflareFunctionWrapper {
    constructor(fnWithProps: ((...args: unknown[]) => unknown) & {
        [key: string | symbol]: unknown;
    });
}

export declare const AI_PLUGIN: Plugin<typeof AIOptionsSchema>;

export declare const AI_PLUGIN_NAME = "ai";

export declare const AIOptionsSchema: z.ZodObject<{
    ai: z.ZodOptional<z.ZodObject<{
        binding: z.ZodString;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString, z.ZodTypeDef, RemoteProxyConnectionString>>;
    }, "strip", z.ZodTypeAny, {
        binding: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }, {
        binding: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    ai?: {
        binding: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    } | undefined;
}, {
    ai?: {
        binding: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    } | undefined;
}>;

export declare const ANALYTICS_ENGINE_PLUGIN: Plugin<typeof AnalyticsEngineSchemaOptionsSchema, typeof AnalyticsEngineSchemaSharedOptionsSchema>;

export declare const ANALYTICS_ENGINE_PLUGIN_NAME = "analytics-engine";

export declare const AnalyticsEngineSchemaOptionsSchema: z.ZodObject<{
    analyticsEngineDatasets: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        dataset: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        dataset: string;
    }, {
        dataset: string;
    }>>>;
}, "strip", z.ZodTypeAny, {
    analyticsEngineDatasets?: Record<string, {
        dataset: string;
    }> | undefined;
}, {
    analyticsEngineDatasets?: Record<string, {
        dataset: string;
    }> | undefined;
}>;

export declare const AnalyticsEngineSchemaSharedOptionsSchema: z.ZodObject<{
    analyticsEngineDatasetsPersist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
}, "strip", z.ZodTypeAny, {
    analyticsEngineDatasetsPersist?: string | boolean | undefined;
}, {
    analyticsEngineDatasetsPersist?: string | boolean | undefined;
}>;

export declare type AnyHeaders = http.IncomingHttpHeaders | string[];

export declare type AssetReverseMap = {
    [pathHash: string]: {
        filePath: string;
        contentType: string | null;
    };
};

export declare const ASSETS_PLUGIN: Plugin<typeof AssetsOptionsSchema>;

export declare const AssetsOptionsSchema: z.ZodObject<{
    assets: z.ZodOptional<z.ZodObject<{
        workerName: z.ZodOptional<z.ZodString>;
        directory: z.ZodEffects<z.ZodString, string, string>;
        binding: z.ZodOptional<z.ZodString>;
        routerConfig: z.ZodOptional<z.ZodObject<{
            account_id: z.ZodOptional<z.ZodNumber>;
            script_id: z.ZodOptional<z.ZodNumber>;
            debug: z.ZodOptional<z.ZodBoolean>;
            invoke_user_worker_ahead_of_assets: z.ZodOptional<z.ZodBoolean>;
            static_routing: z.ZodOptional<z.ZodObject<{
                user_worker: z.ZodArray<z.ZodString, "many">;
                asset_worker: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                user_worker: string[];
                asset_worker?: string[] | undefined;
            }, {
                user_worker: string[];
                asset_worker?: string[] | undefined;
            }>>;
            has_user_worker: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            account_id?: number | undefined;
            script_id?: number | undefined;
            debug?: boolean | undefined;
            invoke_user_worker_ahead_of_assets?: boolean | undefined;
            static_routing?: {
                user_worker: string[];
                asset_worker?: string[] | undefined;
            } | undefined;
            has_user_worker?: boolean | undefined;
        }, {
            account_id?: number | undefined;
            script_id?: number | undefined;
            debug?: boolean | undefined;
            invoke_user_worker_ahead_of_assets?: boolean | undefined;
            static_routing?: {
                user_worker: string[];
                asset_worker?: string[] | undefined;
            } | undefined;
            has_user_worker?: boolean | undefined;
        }>>;
        assetConfig: z.ZodOptional<z.ZodObject<Omit<{
            account_id: z.ZodOptional<z.ZodNumber>;
            script_id: z.ZodOptional<z.ZodNumber>;
            debug: z.ZodOptional<z.ZodBoolean>;
            compatibility_date: z.ZodOptional<z.ZodString>;
            compatibility_flags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            html_handling: z.ZodOptional<z.ZodEnum<["auto-trailing-slash", "force-trailing-slash", "drop-trailing-slash", "none"]>>;
            not_found_handling: z.ZodOptional<z.ZodEnum<["single-page-application", "404-page", "none"]>>;
            redirects: z.ZodOptional<z.ZodObject<{
                version: z.ZodLiteral<1>;
                staticRules: z.ZodRecord<z.ZodString, z.ZodObject<{
                    status: z.ZodNumber;
                    to: z.ZodString;
                    lineNumber: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    status: number;
                    to: string;
                    lineNumber: number;
                }, {
                    status: number;
                    to: string;
                    lineNumber: number;
                }>>;
                rules: z.ZodRecord<z.ZodString, z.ZodObject<{
                    status: z.ZodNumber;
                    to: z.ZodString;
                }, "strip", z.ZodTypeAny, {
                    status: number;
                    to: string;
                }, {
                    status: number;
                    to: string;
                }>>;
            }, "strip", z.ZodTypeAny, {
                version: 1;
                staticRules: Record<string, {
                    status: number;
                    to: string;
                    lineNumber: number;
                }>;
                rules: Record<string, {
                    status: number;
                    to: string;
                }>;
            }, {
                version: 1;
                staticRules: Record<string, {
                    status: number;
                    to: string;
                    lineNumber: number;
                }>;
                rules: Record<string, {
                    status: number;
                    to: string;
                }>;
            }>>;
            headers: z.ZodOptional<z.ZodObject<{
                version: z.ZodLiteral<2>;
                rules: z.ZodRecord<z.ZodString, z.ZodObject<{
                    set: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    unset: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "strip", z.ZodTypeAny, {
                    set?: Record<string, string> | undefined;
                    unset?: string[] | undefined;
                }, {
                    set?: Record<string, string> | undefined;
                    unset?: string[] | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                version: 2;
                rules: Record<string, {
                    set?: Record<string, string> | undefined;
                    unset?: string[] | undefined;
                }>;
            }, {
                version: 2;
                rules: Record<string, {
                    set?: Record<string, string> | undefined;
                    unset?: string[] | undefined;
                }>;
            }>>;
            has_static_routing: z.ZodOptional<z.ZodBoolean>;
        }, "compatibility_date" | "compatibility_flags">, "strip", z.ZodTypeAny, {
            debug?: boolean | undefined;
            headers?: {
                version: 2;
                rules: Record<string, {
                    set?: Record<string, string> | undefined;
                    unset?: string[] | undefined;
                }>;
            } | undefined;
            account_id?: number | undefined;
            script_id?: number | undefined;
            html_handling?: "none" | "auto-trailing-slash" | "force-trailing-slash" | "drop-trailing-slash" | undefined;
            not_found_handling?: "none" | "single-page-application" | "404-page" | undefined;
            redirects?: {
                version: 1;
                staticRules: Record<string, {
                    status: number;
                    to: string;
                    lineNumber: number;
                }>;
                rules: Record<string, {
                    status: number;
                    to: string;
                }>;
            } | undefined;
            has_static_routing?: boolean | undefined;
        }, {
            debug?: boolean | undefined;
            headers?: {
                version: 2;
                rules: Record<string, {
                    set?: Record<string, string> | undefined;
                    unset?: string[] | undefined;
                }>;
            } | undefined;
            account_id?: number | undefined;
            script_id?: number | undefined;
            html_handling?: "none" | "auto-trailing-slash" | "force-trailing-slash" | "drop-trailing-slash" | undefined;
            not_found_handling?: "none" | "single-page-application" | "404-page" | undefined;
            redirects?: {
                version: 1;
                staticRules: Record<string, {
                    status: number;
                    to: string;
                    lineNumber: number;
                }>;
                rules: Record<string, {
                    status: number;
                    to: string;
                }>;
            } | undefined;
            has_static_routing?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        directory: string;
        workerName?: string | undefined;
        binding?: string | undefined;
        routerConfig?: {
            account_id?: number | undefined;
            script_id?: number | undefined;
            debug?: boolean | undefined;
            invoke_user_worker_ahead_of_assets?: boolean | undefined;
            static_routing?: {
                user_worker: string[];
                asset_worker?: string[] | undefined;
            } | undefined;
            has_user_worker?: boolean | undefined;
        } | undefined;
        assetConfig?: {
            debug?: boolean | undefined;
            headers?: {
                version: 2;
                rules: Record<string, {
                    set?: Record<string, string> | undefined;
                    unset?: string[] | undefined;
                }>;
            } | undefined;
            account_id?: number | undefined;
            script_id?: number | undefined;
            html_handling?: "none" | "auto-trailing-slash" | "force-trailing-slash" | "drop-trailing-slash" | undefined;
            not_found_handling?: "none" | "single-page-application" | "404-page" | undefined;
            redirects?: {
                version: 1;
                staticRules: Record<string, {
                    status: number;
                    to: string;
                    lineNumber: number;
                }>;
                rules: Record<string, {
                    status: number;
                    to: string;
                }>;
            } | undefined;
            has_static_routing?: boolean | undefined;
        } | undefined;
    }, {
        directory: string;
        workerName?: string | undefined;
        binding?: string | undefined;
        routerConfig?: {
            account_id?: number | undefined;
            script_id?: number | undefined;
            debug?: boolean | undefined;
            invoke_user_worker_ahead_of_assets?: boolean | undefined;
            static_routing?: {
                user_worker: string[];
                asset_worker?: string[] | undefined;
            } | undefined;
            has_user_worker?: boolean | undefined;
        } | undefined;
        assetConfig?: {
            debug?: boolean | undefined;
            headers?: {
                version: 2;
                rules: Record<string, {
                    set?: Record<string, string> | undefined;
                    unset?: string[] | undefined;
                }>;
            } | undefined;
            account_id?: number | undefined;
            script_id?: number | undefined;
            html_handling?: "none" | "auto-trailing-slash" | "force-trailing-slash" | "drop-trailing-slash" | undefined;
            not_found_handling?: "none" | "single-page-application" | "404-page" | undefined;
            redirects?: {
                version: 1;
                staticRules: Record<string, {
                    status: number;
                    to: string;
                    lineNumber: number;
                }>;
                rules: Record<string, {
                    status: number;
                    to: string;
                }>;
            } | undefined;
            has_static_routing?: boolean | undefined;
        } | undefined;
    }>>;
    compatibilityDate: z.ZodOptional<z.ZodString>;
    compatibilityFlags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    assets?: {
        directory: string;
        workerName?: string | undefined;
        binding?: string | undefined;
        routerConfig?: {
            account_id?: number | undefined;
            script_id?: number | undefined;
            debug?: boolean | undefined;
            invoke_user_worker_ahead_of_assets?: boolean | undefined;
            static_routing?: {
                user_worker: string[];
                asset_worker?: string[] | undefined;
            } | undefined;
            has_user_worker?: boolean | undefined;
        } | undefined;
        assetConfig?: {
            debug?: boolean | undefined;
            headers?: {
                version: 2;
                rules: Record<string, {
                    set?: Record<string, string> | undefined;
                    unset?: string[] | undefined;
                }>;
            } | undefined;
            account_id?: number | undefined;
            script_id?: number | undefined;
            html_handling?: "none" | "auto-trailing-slash" | "force-trailing-slash" | "drop-trailing-slash" | undefined;
            not_found_handling?: "none" | "single-page-application" | "404-page" | undefined;
            redirects?: {
                version: 1;
                staticRules: Record<string, {
                    status: number;
                    to: string;
                    lineNumber: number;
                }>;
                rules: Record<string, {
                    status: number;
                    to: string;
                }>;
            } | undefined;
            has_static_routing?: boolean | undefined;
        } | undefined;
    } | undefined;
    compatibilityDate?: string | undefined;
    compatibilityFlags?: string[] | undefined;
}, {
    assets?: {
        directory: string;
        workerName?: string | undefined;
        binding?: string | undefined;
        routerConfig?: {
            account_id?: number | undefined;
            script_id?: number | undefined;
            debug?: boolean | undefined;
            invoke_user_worker_ahead_of_assets?: boolean | undefined;
            static_routing?: {
                user_worker: string[];
                asset_worker?: string[] | undefined;
            } | undefined;
            has_user_worker?: boolean | undefined;
        } | undefined;
        assetConfig?: {
            debug?: boolean | undefined;
            headers?: {
                version: 2;
                rules: Record<string, {
                    set?: Record<string, string> | undefined;
                    unset?: string[] | undefined;
                }>;
            } | undefined;
            account_id?: number | undefined;
            script_id?: number | undefined;
            html_handling?: "none" | "auto-trailing-slash" | "force-trailing-slash" | "drop-trailing-slash" | undefined;
            not_found_handling?: "none" | "single-page-application" | "404-page" | undefined;
            redirects?: {
                version: 1;
                staticRules: Record<string, {
                    status: number;
                    to: string;
                    lineNumber: number;
                }>;
                rules: Record<string, {
                    status: number;
                    to: string;
                }>;
            } | undefined;
            has_static_routing?: boolean | undefined;
        } | undefined;
    } | undefined;
    compatibilityDate?: string | undefined;
    compatibilityFlags?: string[] | undefined;
}>;

export declare type Awaitable<T> = T | Promise<T>;

export declare function base64Decode(encoded: string): string;

export declare function base64Encode(value: string): string;

export { BodyInit }

export declare const BROWSER_RENDERING_PLUGIN: Plugin<typeof BrowserRenderingOptionsSchema>;

export declare const BROWSER_RENDERING_PLUGIN_NAME = "browser-rendering";

export declare const BrowserRenderingOptionsSchema: z.ZodObject<{
    browserRendering: z.ZodOptional<z.ZodObject<{
        binding: z.ZodString;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString, z.ZodTypeDef, RemoteProxyConnectionString>>;
    }, "strip", z.ZodTypeAny, {
        binding: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }, {
        binding: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    browserRendering?: {
        binding: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    } | undefined;
}, {
    browserRendering?: {
        binding: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    } | undefined;
}>;

/**
 * The Asset Manifest and Asset Reverse Map are used to map a request path to an asset.
 * 1. Hash path of request
 * 2. Use this path hash to find the manifest entry
 * 3. Get content hash from manifest entry
 * 4a. In prod, use content hash to get asset from KV
 * 4b. In dev, we fake out the KV store and use the file system instead.
 * 	   Use content hash to get file path from asset reverse map.
 */
export declare const buildAssetManifest: (dir: string) => Promise<{
    encodedAssetManifest: Uint8Array<ArrayBuffer>;
    assetsReverseMap: AssetReverseMap;
}>;

export declare const CACHE_PLUGIN: Plugin<typeof CacheOptionsSchema, typeof CacheSharedOptionsSchema>;

export declare const CACHE_PLUGIN_NAME = "cache";

export declare const CacheBindings: {
    readonly MAYBE_JSON_CACHE_WARN_USAGE: "MINIFLARE_CACHE_WARN_USAGE";
};

export declare const CacheHeaders: {
    readonly NAMESPACE: "cf-cache-namespace";
    readonly STATUS: "cf-cache-status";
};

export declare interface CacheObjectCf {
    miniflare?: {
        cacheWarnUsage?: boolean;
    };
}

export declare const CacheOptionsSchema: z.ZodObject<{
    cache: z.ZodOptional<z.ZodBoolean>;
    cacheWarnUsage: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    cache?: boolean | undefined;
    cacheWarnUsage?: boolean | undefined;
}, {
    cache?: boolean | undefined;
    cacheWarnUsage?: boolean | undefined;
}>;

export declare const CacheSharedOptionsSchema: z.ZodObject<{
    cachePersist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
}, "strip", z.ZodTypeAny, {
    cachePersist?: string | boolean | undefined;
}, {
    cachePersist?: string | boolean | undefined;
}>;

export declare class CloseEvent extends Event {
    readonly code: number;
    readonly reason: string;
    readonly wasClean: boolean;
    constructor(type: "close", init?: {
        code?: number;
        reason?: string;
        wasClean?: boolean;
    });
}

export declare interface CompiledModuleRule {
    type: ModuleRuleType;
    include: MatcherRegExps;
}

export declare function compileModuleRules(rules: ModuleRule[]): CompiledModuleRule[];

export declare interface Config {
    services?: Service[];
    sockets?: Socket[];
    v8Flags?: string[];
    extensions?: Extension[];
    autogates?: string[];
    structuredLogging?: boolean;
}

export declare const CORE_PLUGIN: Plugin<typeof CoreOptionsSchema, typeof CoreSharedOptionsSchema>;

export declare const CORE_PLUGIN_NAME = "core";

export declare const CoreBindings: {
    readonly SERVICE_LOOPBACK: "MINIFLARE_LOOPBACK";
    readonly SERVICE_USER_ROUTE_PREFIX: "MINIFLARE_USER_ROUTE_";
    readonly SERVICE_USER_FALLBACK: "MINIFLARE_USER_FALLBACK";
    readonly TEXT_CUSTOM_SERVICE: "MINIFLARE_CUSTOM_SERVICE";
    readonly IMAGES_SERVICE: "MINIFLARE_IMAGES_SERVICE";
    readonly TEXT_UPSTREAM_URL: "MINIFLARE_UPSTREAM_URL";
    readonly JSON_CF_BLOB: "CF_BLOB";
    readonly JSON_ROUTES: "MINIFLARE_ROUTES";
    readonly JSON_LOG_LEVEL: "MINIFLARE_LOG_LEVEL";
    readonly DATA_LIVE_RELOAD_SCRIPT: "MINIFLARE_LIVE_RELOAD_SCRIPT";
    readonly DURABLE_OBJECT_NAMESPACE_PROXY: "MINIFLARE_PROXY";
    readonly DATA_PROXY_SECRET: "MINIFLARE_PROXY_SECRET";
    readonly DATA_PROXY_SHARED_SECRET: "MINIFLARE_PROXY_SHARED_SECRET";
    readonly TRIGGER_HANDLERS: "TRIGGER_HANDLERS";
    readonly LOG_REQUESTS: "LOG_REQUESTS";
    readonly STRIP_DISABLE_PRETTY_ERROR: "STRIP_DISABLE_PRETTY_ERROR";
};

export declare const CoreHeaders: {
    readonly CUSTOM_FETCH_SERVICE: "MF-Custom-Fetch-Service";
    readonly CUSTOM_NODE_SERVICE: "MF-Custom-Node-Service";
    readonly ORIGINAL_URL: "MF-Original-URL";
    readonly PROXY_SHARED_SECRET: "MF-Proxy-Shared-Secret";
    readonly DISABLE_PRETTY_ERROR: "MF-Disable-Pretty-Error";
    readonly ERROR_STACK: "MF-Experimental-Error-Stack";
    readonly ROUTE_OVERRIDE: "MF-Route-Override";
    readonly CF_BLOB: "MF-CF-Blob";
    /** Used by the Vite plugin to pass through the original `sec-fetch-mode` header */
    readonly SEC_FETCH_MODE: "MF-Sec-Fetch-Mode";
    readonly OP_SECRET: "MF-Op-Secret";
    readonly OP: "MF-Op";
    readonly OP_TARGET: "MF-Op-Target";
    readonly OP_KEY: "MF-Op-Key";
    readonly OP_SYNC: "MF-Op-Sync";
    readonly OP_STRINGIFIED_SIZE: "MF-Op-Stringified-Size";
    readonly OP_RESULT_TYPE: "MF-Op-Result-Type";
};

export declare const CoreOptionsSchema: z.ZodEffects<z.ZodIntersection<z.ZodUnion<[z.ZodObject<{
    modules: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["ESModule", "CommonJS", "Text", "Data", "CompiledWasm", "PythonModule", "PythonRequirement"]>;
        path: z.ZodEffects<z.ZodString, string, string>;
        contents: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodType<Uint8Array<ArrayBuffer>, z.ZodTypeDef, Uint8Array<ArrayBuffer>>]>>;
    }, "strip", z.ZodTypeAny, {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        path: string;
        contents?: string | Uint8Array<ArrayBuffer> | undefined;
    }, {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        path: string;
        contents?: string | Uint8Array<ArrayBuffer> | undefined;
    }>, "many">;
    modulesRoot: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strip", z.ZodTypeAny, {
    modules: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        path: string;
        contents?: string | Uint8Array<ArrayBuffer> | undefined;
    }[];
    modulesRoot?: string | undefined;
}, {
    modules: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        path: string;
        contents?: string | Uint8Array<ArrayBuffer> | undefined;
    }[];
    modulesRoot?: string | undefined;
}>, z.ZodObject<{
    script: z.ZodString;
    scriptPath: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    modules: z.ZodOptional<z.ZodBoolean>;
    modulesRules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["ESModule", "CommonJS", "Text", "Data", "CompiledWasm", "PythonModule", "PythonRequirement"]>;
        include: z.ZodArray<z.ZodString, "many">;
        fallthrough: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }, {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }>, "many">>;
    modulesRoot: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strip", z.ZodTypeAny, {
    script: string;
    scriptPath?: string | undefined;
    modules?: boolean | undefined;
    modulesRules?: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
}, {
    script: string;
    scriptPath?: string | undefined;
    modules?: boolean | undefined;
    modulesRules?: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
}>, z.ZodObject<{
    scriptPath: z.ZodEffects<z.ZodString, string, string>;
    modules: z.ZodOptional<z.ZodBoolean>;
    modulesRules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["ESModule", "CommonJS", "Text", "Data", "CompiledWasm", "PythonModule", "PythonRequirement"]>;
        include: z.ZodArray<z.ZodString, "many">;
        fallthrough: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }, {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }>, "many">>;
    modulesRoot: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strip", z.ZodTypeAny, {
    scriptPath: string;
    modules?: boolean | undefined;
    modulesRules?: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
}, {
    scriptPath: string;
    modules?: boolean | undefined;
    modulesRules?: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
}>]>, z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    rootPath: z.ZodOptional<z.ZodEffects<z.ZodString, undefined, string>>;
    compatibilityDate: z.ZodOptional<z.ZodString>;
    compatibilityFlags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    unsafeInspectorProxy: z.ZodOptional<z.ZodBoolean>;
    routes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    bindings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<Json, z.ZodTypeDef, Json>>>;
    wasmBindings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodType<Uint8Array<ArrayBuffer>, z.ZodTypeDef, Uint8Array<ArrayBuffer>>]>>>;
    textBlobBindings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodEffects<z.ZodString, string, string>>>;
    dataBlobBindings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodType<Uint8Array<ArrayBuffer>, z.ZodTypeDef, Uint8Array<ArrayBuffer>>]>>>;
    serviceBindings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodLiteral<typeof kCurrentWorker>, z.ZodObject<{
        name: z.ZodUnion<[z.ZodString, z.ZodLiteral<typeof kCurrentWorker>]>;
        entrypoint: z.ZodOptional<z.ZodString>;
        props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_2, z.ZodTypeDef, RemoteProxyConnectionString_2>>;
    }, "strip", z.ZodTypeAny, {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    }, {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    }>, z.ZodObject<{
        network: z.ZodObject<{
            allow: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            deny: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            tlsOptions: z.ZodOptional<z.ZodObject<{
                keypair: z.ZodOptional<z.ZodObject<{
                    privateKey: z.ZodOptional<z.ZodString>;
                    certificateChain: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                }, {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                }>>;
                requireClientCerts: z.ZodOptional<z.ZodBoolean>;
                trustBrowserCas: z.ZodOptional<z.ZodBoolean>;
                trustedCertificates: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                minVersion: z.ZodOptional<z.ZodNativeEnum<{
                    readonly GOOD_DEFAULT: 0;
                    readonly SSL3: 1;
                    readonly TLS1DOT0: 2;
                    readonly TLS1DOT1: 3;
                    readonly TLS1DOT2: 4;
                    readonly TLS1DOT3: 5;
                }>>;
                cipherList: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            }, {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        }, {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    }, {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    }>, z.ZodObject<{
        external: z.ZodType<ExternalServer_2, z.ZodTypeDef, ExternalServer_2>;
    }, "strip", z.ZodTypeAny, {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    }, {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    }>, z.ZodObject<{
        disk: z.ZodObject<{
            path: z.ZodString;
            writable: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            writable?: boolean | undefined;
        }, {
            path: string;
            writable?: boolean | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    }, {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    }>, z.ZodObject<{
        node: z.ZodType<(req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>, z.ZodTypeDef, (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>>;
    }, "strip", z.ZodTypeAny, {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    }, {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    }>, z.ZodType<(request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>, z.ZodTypeDef, (request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>>]>>>;
    wrappedBindings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodObject<{
        scriptName: z.ZodString;
        entrypoint: z.ZodOptional<z.ZodString>;
        bindings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<Json, z.ZodTypeDef, Json>>>;
    }, "strip", z.ZodTypeAny, {
        scriptName: string;
        entrypoint?: string | undefined;
        bindings?: Record<string, Json> | undefined;
    }, {
        scriptName: string;
        entrypoint?: string | undefined;
        bindings?: Record<string, Json> | undefined;
    }>]>>>;
    outboundService: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<typeof kCurrentWorker>, z.ZodObject<{
        name: z.ZodUnion<[z.ZodString, z.ZodLiteral<typeof kCurrentWorker>]>;
        entrypoint: z.ZodOptional<z.ZodString>;
        props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_2, z.ZodTypeDef, RemoteProxyConnectionString_2>>;
    }, "strip", z.ZodTypeAny, {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    }, {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    }>, z.ZodObject<{
        network: z.ZodObject<{
            allow: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            deny: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            tlsOptions: z.ZodOptional<z.ZodObject<{
                keypair: z.ZodOptional<z.ZodObject<{
                    privateKey: z.ZodOptional<z.ZodString>;
                    certificateChain: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                }, {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                }>>;
                requireClientCerts: z.ZodOptional<z.ZodBoolean>;
                trustBrowserCas: z.ZodOptional<z.ZodBoolean>;
                trustedCertificates: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                minVersion: z.ZodOptional<z.ZodNativeEnum<{
                    readonly GOOD_DEFAULT: 0;
                    readonly SSL3: 1;
                    readonly TLS1DOT0: 2;
                    readonly TLS1DOT1: 3;
                    readonly TLS1DOT2: 4;
                    readonly TLS1DOT3: 5;
                }>>;
                cipherList: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            }, {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        }, {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    }, {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    }>, z.ZodObject<{
        external: z.ZodType<ExternalServer_2, z.ZodTypeDef, ExternalServer_2>;
    }, "strip", z.ZodTypeAny, {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    }, {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    }>, z.ZodObject<{
        disk: z.ZodObject<{
            path: z.ZodString;
            writable: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            writable?: boolean | undefined;
        }, {
            path: string;
            writable?: boolean | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    }, {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    }>, z.ZodObject<{
        node: z.ZodType<(req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>, z.ZodTypeDef, (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>>;
    }, "strip", z.ZodTypeAny, {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    }, {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    }>, z.ZodType<(request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>, z.ZodTypeDef, (request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>>]>>;
    fetchMock: z.ZodOptional<z.ZodType<MockAgent<MockAgent.Options>, z.ZodTypeDef, MockAgent<MockAgent.Options>>>;
    unsafeEphemeralDurableObjects: z.ZodOptional<z.ZodBoolean>;
    unsafeDirectSockets: z.ZodOptional<z.ZodArray<z.ZodObject<{
        host: z.ZodOptional<z.ZodString>;
        port: z.ZodOptional<z.ZodNumber>;
        serviceName: z.ZodOptional<z.ZodString>;
        entrypoint: z.ZodOptional<z.ZodString>;
        proxy: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        host?: string | undefined;
        port?: number | undefined;
        serviceName?: string | undefined;
        entrypoint?: string | undefined;
        proxy?: boolean | undefined;
    }, {
        host?: string | undefined;
        port?: number | undefined;
        serviceName?: string | undefined;
        entrypoint?: string | undefined;
        proxy?: boolean | undefined;
    }>, "many">>;
    unsafeEvalBinding: z.ZodOptional<z.ZodString>;
    unsafeUseModuleFallbackService: z.ZodOptional<z.ZodBoolean>;
    /** Used to set the vitest pool worker SELF binding to point to the Router Worker if there are assets.
     (If there are assets but we're not using vitest, the miniflare entry worker can point directly to
     Router Worker)
     */
    hasAssetsAndIsVitest: z.ZodOptional<z.ZodBoolean>;
    tails: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodLiteral<typeof kCurrentWorker>, z.ZodObject<{
        name: z.ZodUnion<[z.ZodString, z.ZodLiteral<typeof kCurrentWorker>]>;
        entrypoint: z.ZodOptional<z.ZodString>;
        props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_2, z.ZodTypeDef, RemoteProxyConnectionString_2>>;
    }, "strip", z.ZodTypeAny, {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    }, {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    }>, z.ZodObject<{
        network: z.ZodObject<{
            allow: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            deny: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            tlsOptions: z.ZodOptional<z.ZodObject<{
                keypair: z.ZodOptional<z.ZodObject<{
                    privateKey: z.ZodOptional<z.ZodString>;
                    certificateChain: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                }, {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                }>>;
                requireClientCerts: z.ZodOptional<z.ZodBoolean>;
                trustBrowserCas: z.ZodOptional<z.ZodBoolean>;
                trustedCertificates: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                minVersion: z.ZodOptional<z.ZodNativeEnum<{
                    readonly GOOD_DEFAULT: 0;
                    readonly SSL3: 1;
                    readonly TLS1DOT0: 2;
                    readonly TLS1DOT1: 3;
                    readonly TLS1DOT2: 4;
                    readonly TLS1DOT3: 5;
                }>>;
                cipherList: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            }, {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        }, {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    }, {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    }>, z.ZodObject<{
        external: z.ZodType<ExternalServer_2, z.ZodTypeDef, ExternalServer_2>;
    }, "strip", z.ZodTypeAny, {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    }, {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    }>, z.ZodObject<{
        disk: z.ZodObject<{
            path: z.ZodString;
            writable: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            writable?: boolean | undefined;
        }, {
            path: string;
            writable?: boolean | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    }, {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    }>, z.ZodObject<{
        node: z.ZodType<(req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>, z.ZodTypeDef, (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>>;
    }, "strip", z.ZodTypeAny, {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    }, {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    }>, z.ZodType<(request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>, z.ZodTypeDef, (request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>>]>, "many">>;
    streamingTails: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodLiteral<typeof kCurrentWorker>, z.ZodObject<{
        name: z.ZodUnion<[z.ZodString, z.ZodLiteral<typeof kCurrentWorker>]>;
        entrypoint: z.ZodOptional<z.ZodString>;
        props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_2, z.ZodTypeDef, RemoteProxyConnectionString_2>>;
    }, "strip", z.ZodTypeAny, {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    }, {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    }>, z.ZodObject<{
        network: z.ZodObject<{
            allow: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            deny: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            tlsOptions: z.ZodOptional<z.ZodObject<{
                keypair: z.ZodOptional<z.ZodObject<{
                    privateKey: z.ZodOptional<z.ZodString>;
                    certificateChain: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                }, {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                }>>;
                requireClientCerts: z.ZodOptional<z.ZodBoolean>;
                trustBrowserCas: z.ZodOptional<z.ZodBoolean>;
                trustedCertificates: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                minVersion: z.ZodOptional<z.ZodNativeEnum<{
                    readonly GOOD_DEFAULT: 0;
                    readonly SSL3: 1;
                    readonly TLS1DOT0: 2;
                    readonly TLS1DOT1: 3;
                    readonly TLS1DOT2: 4;
                    readonly TLS1DOT3: 5;
                }>>;
                cipherList: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            }, {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        }, {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    }, {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    }>, z.ZodObject<{
        external: z.ZodType<ExternalServer_2, z.ZodTypeDef, ExternalServer_2>;
    }, "strip", z.ZodTypeAny, {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    }, {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    }>, z.ZodObject<{
        disk: z.ZodObject<{
            path: z.ZodString;
            writable: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            writable?: boolean | undefined;
        }, {
            path: string;
            writable?: boolean | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    }, {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    }>, z.ZodObject<{
        node: z.ZodType<(req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>, z.ZodTypeDef, (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>>;
    }, "strip", z.ZodTypeAny, {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    }, {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    }>, z.ZodType<(request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>, z.ZodTypeDef, (request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>>]>, "many">>;
    stripCfConnectingIp: z.ZodDefault<z.ZodBoolean>;
    /** Configuration used to connect to the container engine */
    containerEngine: z.ZodOptional<z.ZodUnion<[z.ZodObject<{
        localDocker: z.ZodObject<{
            socketPath: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            socketPath: string;
        }, {
            socketPath: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        localDocker: {
            socketPath: string;
        };
    }, {
        localDocker: {
            socketPath: string;
        };
    }>, z.ZodString]>>;
    unsafeBindings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        plugin: z.ZodObject<{
            package: z.ZodString;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            package: string;
        }, {
            name: string;
            package: string;
        }>;
        options: z.ZodRecord<z.ZodString, z.ZodType<Json, z.ZodTypeDef, Json>>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        name: string;
        options: Record<string, Json>;
        plugin: {
            name: string;
            package: string;
        };
    }, {
        type: string;
        name: string;
        options: Record<string, Json>;
        plugin: {
            name: string;
            package: string;
        };
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    stripCfConnectingIp: boolean;
    name?: string | undefined;
    rootPath?: undefined;
    compatibilityDate?: string | undefined;
    compatibilityFlags?: string[] | undefined;
    unsafeInspectorProxy?: boolean | undefined;
    routes?: string[] | undefined;
    bindings?: Record<string, Json> | undefined;
    wasmBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    textBlobBindings?: Record<string, string> | undefined;
    dataBlobBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    serviceBindings?: Record<string, string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>)> | undefined;
    wrappedBindings?: Record<string, string | {
        scriptName: string;
        entrypoint?: string | undefined;
        bindings?: Record<string, Json> | undefined;
    }> | undefined;
    outboundService?: string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>) | undefined;
    fetchMock?: MockAgent<MockAgent.Options> | undefined;
    unsafeEphemeralDurableObjects?: boolean | undefined;
    unsafeDirectSockets?: {
        host?: string | undefined;
        port?: number | undefined;
        serviceName?: string | undefined;
        entrypoint?: string | undefined;
        proxy?: boolean | undefined;
    }[] | undefined;
    unsafeEvalBinding?: string | undefined;
    unsafeUseModuleFallbackService?: boolean | undefined;
    hasAssetsAndIsVitest?: boolean | undefined;
    tails?: (string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>))[] | undefined;
    streamingTails?: (string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>))[] | undefined;
    containerEngine?: string | {
        localDocker: {
            socketPath: string;
        };
    } | undefined;
    unsafeBindings?: {
        type: string;
        name: string;
        options: Record<string, Json>;
        plugin: {
            name: string;
            package: string;
        };
    }[] | undefined;
}, {
    name?: string | undefined;
    rootPath?: string | undefined;
    compatibilityDate?: string | undefined;
    compatibilityFlags?: string[] | undefined;
    unsafeInspectorProxy?: boolean | undefined;
    routes?: string[] | undefined;
    bindings?: Record<string, Json> | undefined;
    wasmBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    textBlobBindings?: Record<string, string> | undefined;
    dataBlobBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    serviceBindings?: Record<string, string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>)> | undefined;
    wrappedBindings?: Record<string, string | {
        scriptName: string;
        entrypoint?: string | undefined;
        bindings?: Record<string, Json> | undefined;
    }> | undefined;
    outboundService?: string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>) | undefined;
    fetchMock?: MockAgent<MockAgent.Options> | undefined;
    unsafeEphemeralDurableObjects?: boolean | undefined;
    unsafeDirectSockets?: {
        host?: string | undefined;
        port?: number | undefined;
        serviceName?: string | undefined;
        entrypoint?: string | undefined;
        proxy?: boolean | undefined;
    }[] | undefined;
    unsafeEvalBinding?: string | undefined;
    unsafeUseModuleFallbackService?: boolean | undefined;
    hasAssetsAndIsVitest?: boolean | undefined;
    tails?: (string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>))[] | undefined;
    streamingTails?: (string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>))[] | undefined;
    stripCfConnectingIp?: boolean | undefined;
    containerEngine?: string | {
        localDocker: {
            socketPath: string;
        };
    } | undefined;
    unsafeBindings?: {
        type: string;
        name: string;
        options: Record<string, Json>;
        plugin: {
            name: string;
            package: string;
        };
    }[] | undefined;
}>>, ({
    modules: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        path: string;
        contents?: string | Uint8Array<ArrayBuffer> | undefined;
    }[];
    modulesRoot?: string | undefined;
} & {
    stripCfConnectingIp: boolean;
    name?: string | undefined;
    rootPath?: undefined;
    compatibilityDate?: string | undefined;
    compatibilityFlags?: string[] | undefined;
    unsafeInspectorProxy?: boolean | undefined;
    routes?: string[] | undefined;
    bindings?: Record<string, Json> | undefined;
    wasmBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    textBlobBindings?: Record<string, string> | undefined;
    dataBlobBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    serviceBindings?: Record<string, string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>)> | undefined;
    wrappedBindings?: Record<string, string | {
        scriptName: string;
        entrypoint?: string | undefined;
        bindings?: Record<string, Json> | undefined;
    }> | undefined;
    outboundService?: string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>) | undefined;
    fetchMock?: MockAgent<MockAgent.Options> | undefined;
    unsafeEphemeralDurableObjects?: boolean | undefined;
    unsafeDirectSockets?: {
        host?: string | undefined;
        port?: number | undefined;
        serviceName?: string | undefined;
        entrypoint?: string | undefined;
        proxy?: boolean | undefined;
    }[] | undefined;
    unsafeEvalBinding?: string | undefined;
    unsafeUseModuleFallbackService?: boolean | undefined;
    hasAssetsAndIsVitest?: boolean | undefined;
    tails?: (string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>))[] | undefined;
    streamingTails?: (string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>))[] | undefined;
    containerEngine?: string | {
        localDocker: {
            socketPath: string;
        };
    } | undefined;
    unsafeBindings?: {
        type: string;
        name: string;
        options: Record<string, Json>;
        plugin: {
            name: string;
            package: string;
        };
    }[] | undefined;
}) | ({
    script: string;
    scriptPath?: string | undefined;
    modules?: boolean | undefined;
    modulesRules?: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
} & {
    stripCfConnectingIp: boolean;
    name?: string | undefined;
    rootPath?: undefined;
    compatibilityDate?: string | undefined;
    compatibilityFlags?: string[] | undefined;
    unsafeInspectorProxy?: boolean | undefined;
    routes?: string[] | undefined;
    bindings?: Record<string, Json> | undefined;
    wasmBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    textBlobBindings?: Record<string, string> | undefined;
    dataBlobBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    serviceBindings?: Record<string, string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>)> | undefined;
    wrappedBindings?: Record<string, string | {
        scriptName: string;
        entrypoint?: string | undefined;
        bindings?: Record<string, Json> | undefined;
    }> | undefined;
    outboundService?: string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>) | undefined;
    fetchMock?: MockAgent<MockAgent.Options> | undefined;
    unsafeEphemeralDurableObjects?: boolean | undefined;
    unsafeDirectSockets?: {
        host?: string | undefined;
        port?: number | undefined;
        serviceName?: string | undefined;
        entrypoint?: string | undefined;
        proxy?: boolean | undefined;
    }[] | undefined;
    unsafeEvalBinding?: string | undefined;
    unsafeUseModuleFallbackService?: boolean | undefined;
    hasAssetsAndIsVitest?: boolean | undefined;
    tails?: (string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>))[] | undefined;
    streamingTails?: (string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>))[] | undefined;
    containerEngine?: string | {
        localDocker: {
            socketPath: string;
        };
    } | undefined;
    unsafeBindings?: {
        type: string;
        name: string;
        options: Record<string, Json>;
        plugin: {
            name: string;
            package: string;
        };
    }[] | undefined;
}) | ({
    scriptPath: string;
    modules?: boolean | undefined;
    modulesRules?: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
} & {
    stripCfConnectingIp: boolean;
    name?: string | undefined;
    rootPath?: undefined;
    compatibilityDate?: string | undefined;
    compatibilityFlags?: string[] | undefined;
    unsafeInspectorProxy?: boolean | undefined;
    routes?: string[] | undefined;
    bindings?: Record<string, Json> | undefined;
    wasmBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    textBlobBindings?: Record<string, string> | undefined;
    dataBlobBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    serviceBindings?: Record<string, string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>)> | undefined;
    wrappedBindings?: Record<string, string | {
        scriptName: string;
        entrypoint?: string | undefined;
        bindings?: Record<string, Json> | undefined;
    }> | undefined;
    outboundService?: string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>) | undefined;
    fetchMock?: MockAgent<MockAgent.Options> | undefined;
    unsafeEphemeralDurableObjects?: boolean | undefined;
    unsafeDirectSockets?: {
        host?: string | undefined;
        port?: number | undefined;
        serviceName?: string | undefined;
        entrypoint?: string | undefined;
        proxy?: boolean | undefined;
    }[] | undefined;
    unsafeEvalBinding?: string | undefined;
    unsafeUseModuleFallbackService?: boolean | undefined;
    hasAssetsAndIsVitest?: boolean | undefined;
    tails?: (string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>))[] | undefined;
    streamingTails?: (string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>))[] | undefined;
    containerEngine?: string | {
        localDocker: {
            socketPath: string;
        };
    } | undefined;
    unsafeBindings?: {
        type: string;
        name: string;
        options: Record<string, Json>;
        plugin: {
            name: string;
            package: string;
        };
    }[] | undefined;
}), ({
    modules: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        path: string;
        contents?: string | Uint8Array<ArrayBuffer> | undefined;
    }[];
    modulesRoot?: string | undefined;
} | {
    script: string;
    scriptPath?: string | undefined;
    modules?: boolean | undefined;
    modulesRules?: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
} | {
    scriptPath: string;
    modules?: boolean | undefined;
    modulesRules?: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
}) & {
    name?: string | undefined;
    rootPath?: string | undefined;
    compatibilityDate?: string | undefined;
    compatibilityFlags?: string[] | undefined;
    unsafeInspectorProxy?: boolean | undefined;
    routes?: string[] | undefined;
    bindings?: Record<string, Json> | undefined;
    wasmBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    textBlobBindings?: Record<string, string> | undefined;
    dataBlobBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    serviceBindings?: Record<string, string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>)> | undefined;
    wrappedBindings?: Record<string, string | {
        scriptName: string;
        entrypoint?: string | undefined;
        bindings?: Record<string, Json> | undefined;
    }> | undefined;
    outboundService?: string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>) | undefined;
    fetchMock?: MockAgent<MockAgent.Options> | undefined;
    unsafeEphemeralDurableObjects?: boolean | undefined;
    unsafeDirectSockets?: {
        host?: string | undefined;
        port?: number | undefined;
        serviceName?: string | undefined;
        entrypoint?: string | undefined;
        proxy?: boolean | undefined;
    }[] | undefined;
    unsafeEvalBinding?: string | undefined;
    unsafeUseModuleFallbackService?: boolean | undefined;
    hasAssetsAndIsVitest?: boolean | undefined;
    tails?: (string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>))[] | undefined;
    streamingTails?: (string | typeof kCurrentWorker | {
        name: string | typeof kCurrentWorker;
        entrypoint?: string | undefined;
        props?: Record<string, unknown> | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString_2 | undefined;
    } | {
        network: {
            allow?: string[] | undefined;
            deny?: string[] | undefined;
            tlsOptions?: {
                keypair?: {
                    privateKey?: string | undefined;
                    certificateChain?: string | undefined;
                } | undefined;
                requireClientCerts?: boolean | undefined;
                trustBrowserCas?: boolean | undefined;
                trustedCertificates?: string[] | undefined;
                minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
                cipherList?: string | undefined;
            } | undefined;
        };
    } | {
        external: ExternalServer_2 & (ExternalServer_2 | undefined);
    } | {
        disk: {
            path: string;
            writable?: boolean | undefined;
        };
    } | {
        node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_2) => Awaitable<void>;
    } | ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>))[] | undefined;
    stripCfConnectingIp?: boolean | undefined;
    containerEngine?: string | {
        localDocker: {
            socketPath: string;
        };
    } | undefined;
    unsafeBindings?: {
        type: string;
        name: string;
        options: Record<string, Json>;
        plugin: {
            name: string;
            package: string;
        };
    }[] | undefined;
}>;

export declare const CoreSharedOptionsSchema: z.ZodEffects<z.ZodObject<{
    rootPath: z.ZodOptional<z.ZodEffects<z.ZodString, undefined, string>>;
    host: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
    https: z.ZodOptional<z.ZodBoolean>;
    httpsKey: z.ZodOptional<z.ZodString>;
    httpsKeyPath: z.ZodOptional<z.ZodString>;
    httpsCert: z.ZodOptional<z.ZodString>;
    httpsCertPath: z.ZodOptional<z.ZodString>;
    inspectorPort: z.ZodOptional<z.ZodNumber>;
    verbose: z.ZodOptional<z.ZodBoolean>;
    log: z.ZodOptional<z.ZodType<Log, z.ZodTypeDef, Log>>;
    handleRuntimeStdio: z.ZodOptional<z.ZodFunction<z.ZodTuple<[z.ZodType<Readable, z.ZodTypeDef, Readable>, z.ZodType<Readable, z.ZodTypeDef, Readable>], null>, z.ZodUnknown>>;
    handleStructuredLogs: z.ZodOptional<z.ZodFunction<z.ZodTuple<[z.ZodObject<{
        timestamp: z.ZodNumber;
        level: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        timestamp: number;
        level: string;
    }, {
        message: string;
        timestamp: number;
        level: string;
    }>], null>, z.ZodVoid>>;
    upstream: z.ZodOptional<z.ZodString>;
    cf: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodRecord<z.ZodString, z.ZodAny>]>>;
    liveReload: z.ZodOptional<z.ZodBoolean>;
    unsafeDevRegistryPath: z.ZodOptional<z.ZodString>;
    unsafeDevRegistryDurableObjectProxy: z.ZodDefault<z.ZodBoolean>;
    unsafeHandleDevRegistryUpdate: z.ZodOptional<z.ZodFunction<z.ZodTuple<[z.ZodType<WorkerRegistry, z.ZodTypeDef, WorkerRegistry>], null>, z.ZodUnknown>>;
    unsafeProxySharedSecret: z.ZodOptional<z.ZodString>;
    unsafeModuleFallbackService: z.ZodOptional<z.ZodType<(request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>, z.ZodTypeDef, (request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>>>;
    unsafeStickyBlobs: z.ZodOptional<z.ZodBoolean>;
    unsafeTriggerHandlers: z.ZodOptional<z.ZodBoolean>;
    logRequests: z.ZodDefault<z.ZodBoolean>;
    defaultPersistRoot: z.ZodOptional<z.ZodString>;
    stripDisablePrettyError: z.ZodDefault<z.ZodBoolean>;
    structuredWorkerdLogs: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    unsafeDevRegistryDurableObjectProxy: boolean;
    logRequests: boolean;
    stripDisablePrettyError: boolean;
    rootPath?: undefined;
    host?: string | undefined;
    port?: number | undefined;
    https?: boolean | undefined;
    httpsKey?: string | undefined;
    httpsKeyPath?: string | undefined;
    httpsCert?: string | undefined;
    httpsCertPath?: string | undefined;
    inspectorPort?: number | undefined;
    verbose?: boolean | undefined;
    log?: Log | undefined;
    handleRuntimeStdio?: ((args_0: Readable, args_1: Readable) => unknown) | undefined;
    handleStructuredLogs?: ((args_0: {
        message: string;
        timestamp: number;
        level: string;
    }) => void) | undefined;
    upstream?: string | undefined;
    cf?: string | boolean | Record<string, any> | undefined;
    liveReload?: boolean | undefined;
    unsafeDevRegistryPath?: string | undefined;
    unsafeHandleDevRegistryUpdate?: ((args_0: WorkerRegistry) => unknown) | undefined;
    unsafeProxySharedSecret?: string | undefined;
    unsafeModuleFallbackService?: ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>) | undefined;
    unsafeStickyBlobs?: boolean | undefined;
    unsafeTriggerHandlers?: boolean | undefined;
    defaultPersistRoot?: string | undefined;
    structuredWorkerdLogs?: boolean | undefined;
}, {
    rootPath?: string | undefined;
    host?: string | undefined;
    port?: number | undefined;
    https?: boolean | undefined;
    httpsKey?: string | undefined;
    httpsKeyPath?: string | undefined;
    httpsCert?: string | undefined;
    httpsCertPath?: string | undefined;
    inspectorPort?: number | undefined;
    verbose?: boolean | undefined;
    log?: Log | undefined;
    handleRuntimeStdio?: ((args_0: Readable, args_1: Readable) => unknown) | undefined;
    handleStructuredLogs?: ((args_0: {
        message: string;
        timestamp: number;
        level: string;
    }) => void) | undefined;
    upstream?: string | undefined;
    cf?: string | boolean | Record<string, any> | undefined;
    liveReload?: boolean | undefined;
    unsafeDevRegistryPath?: string | undefined;
    unsafeDevRegistryDurableObjectProxy?: boolean | undefined;
    unsafeHandleDevRegistryUpdate?: ((args_0: WorkerRegistry) => unknown) | undefined;
    unsafeProxySharedSecret?: string | undefined;
    unsafeModuleFallbackService?: ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>) | undefined;
    unsafeStickyBlobs?: boolean | undefined;
    unsafeTriggerHandlers?: boolean | undefined;
    logRequests?: boolean | undefined;
    defaultPersistRoot?: string | undefined;
    stripDisablePrettyError?: boolean | undefined;
    structuredWorkerdLogs?: boolean | undefined;
}>, {
    unsafeDevRegistryDurableObjectProxy: boolean;
    logRequests: boolean;
    stripDisablePrettyError: boolean;
    rootPath?: undefined;
    host?: string | undefined;
    port?: number | undefined;
    https?: boolean | undefined;
    httpsKey?: string | undefined;
    httpsKeyPath?: string | undefined;
    httpsCert?: string | undefined;
    httpsCertPath?: string | undefined;
    inspectorPort?: number | undefined;
    verbose?: boolean | undefined;
    log?: Log | undefined;
    handleRuntimeStdio?: ((args_0: Readable, args_1: Readable) => unknown) | undefined;
    handleStructuredLogs?: ((args_0: {
        message: string;
        timestamp: number;
        level: string;
    }) => void) | undefined;
    upstream?: string | undefined;
    cf?: string | boolean | Record<string, any> | undefined;
    liveReload?: boolean | undefined;
    unsafeDevRegistryPath?: string | undefined;
    unsafeHandleDevRegistryUpdate?: ((args_0: WorkerRegistry) => unknown) | undefined;
    unsafeProxySharedSecret?: string | undefined;
    unsafeModuleFallbackService?: ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>) | undefined;
    unsafeStickyBlobs?: boolean | undefined;
    unsafeTriggerHandlers?: boolean | undefined;
    defaultPersistRoot?: string | undefined;
    structuredWorkerdLogs?: boolean | undefined;
}, {
    rootPath?: string | undefined;
    host?: string | undefined;
    port?: number | undefined;
    https?: boolean | undefined;
    httpsKey?: string | undefined;
    httpsKeyPath?: string | undefined;
    httpsCert?: string | undefined;
    httpsCertPath?: string | undefined;
    inspectorPort?: number | undefined;
    verbose?: boolean | undefined;
    log?: Log | undefined;
    handleRuntimeStdio?: ((args_0: Readable, args_1: Readable) => unknown) | undefined;
    handleStructuredLogs?: ((args_0: {
        message: string;
        timestamp: number;
        level: string;
    }) => void) | undefined;
    upstream?: string | undefined;
    cf?: string | boolean | Record<string, any> | undefined;
    liveReload?: boolean | undefined;
    unsafeDevRegistryPath?: string | undefined;
    unsafeDevRegistryDurableObjectProxy?: boolean | undefined;
    unsafeHandleDevRegistryUpdate?: ((args_0: WorkerRegistry) => unknown) | undefined;
    unsafeProxySharedSecret?: string | undefined;
    unsafeModuleFallbackService?: ((request: Request_3, miniflare: Miniflare_2) => Awaitable<Response_3>) | undefined;
    unsafeStickyBlobs?: boolean | undefined;
    unsafeTriggerHandlers?: boolean | undefined;
    logRequests?: boolean | undefined;
    defaultPersistRoot?: string | undefined;
    stripDisablePrettyError?: boolean | undefined;
    structuredWorkerdLogs?: boolean | undefined;
}>;

export declare function coupleWebSocket(ws: NodeWebSocket, pair: WebSocket): Promise<void>;

export declare function createFetchMock(): MockAgent<MockAgent.Options>;

export declare function createHTTPReducers(impl: PlatformImpl<unknown>): ReducersRevivers;

export declare function createHTTPRevivers<RS>(impl: PlatformImpl<RS>): ReducersRevivers;

export declare const D1_PLUGIN: Plugin<typeof D1OptionsSchema, typeof D1SharedOptionsSchema>;

export declare const D1_PLUGIN_NAME = "d1";

export declare const D1OptionsSchema: z.ZodObject<{
    d1Databases: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodString>, z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString, z.ZodTypeDef, RemoteProxyConnectionString>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }, {
        id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }>>, z.ZodArray<z.ZodString, "many">]>>;
}, "strip", z.ZodTypeAny, {
    d1Databases?: string[] | Record<string, string> | Record<string, {
        id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
}, {
    d1Databases?: string[] | Record<string, string> | Record<string, {
        id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
}>;

export declare const D1SharedOptionsSchema: z.ZodObject<{
    d1Persist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
}, "strip", z.ZodTypeAny, {
    d1Persist?: string | boolean | undefined;
}, {
    d1Persist?: string | boolean | undefined;
}>;

export declare function decodeSitesKey(key: string): string;

export declare const DEFAULT_PERSIST_ROOT = ".mf";

export declare class DeferredPromise<T> extends Promise<T> {
    readonly resolve: DeferredPromiseResolve<T>;
    readonly reject: DeferredPromiseReject;
    constructor(executor?: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void);
}

export declare type DeferredPromiseReject = (reason?: any) => void;

export declare type DeferredPromiseResolve<T> = (value: T | PromiseLike<T>) => void;

export declare function deserialiseRegExps(matcher: SerialisableMatcherRegExps): MatcherRegExps;

export declare function deserialiseSiteRegExps(siteRegExps: SerialisableSiteMatcherRegExps): SiteMatcherRegExps;

export declare interface DiskDirectory {
    path?: string;
    writable?: boolean;
    allowDotfiles?: boolean;
}

export declare const DISPATCH_NAMESPACE_PLUGIN: Plugin<typeof DispatchNamespaceOptionsSchema>;

export declare const DISPATCH_NAMESPACE_PLUGIN_NAME = "dispatch-namespace";

export declare type DispatchFetch = (input: RequestInfo, init?: RequestInit_2<Partial<IncomingRequestCfProperties>>) => Promise<Response_2>;

/**
 * Dispatcher created for each `dispatchFetch()` call. Ensures request origin
 * in Worker matches that passed to `dispatchFetch()`, not the address the
 * `workerd` server is listening on. Handles cases where `fetch()` redirects to
 * same origin and different external origins.
 */
export declare class DispatchFetchDispatcher extends undici.Dispatcher {
    private readonly globalDispatcher;
    private readonly runtimeDispatcher;
    private readonly actualRuntimeOrigin;
    private readonly userRuntimeOrigin;
    private readonly cfBlobJson?;
    /**
     * @param globalDispatcher 		Dispatcher to use for all non-runtime requests
     * 												 		(rejects unauthorised certificates)
     * @param runtimeDispatcher 	Dispatcher to use for runtime requests
     * 														(permits unauthorised certificates)
     * @param actualRuntimeOrigin	Origin to send all runtime requests to
     * @param userRuntimeOrigin 	Origin to treat as runtime request
     * 														(initial URL passed by user to `dispatchFetch()`)
     * @param cfBlob							`request.cf` blob override for runtime requests
     */
    constructor(globalDispatcher: undici.Dispatcher, runtimeDispatcher: undici.Dispatcher, actualRuntimeOrigin: string, userRuntimeOrigin: string, cfBlob?: IncomingRequestCfProperties);
    addHeaders(headers: undici.Headers, path: string): void;
    dispatch(options: undici.Dispatcher.DispatchOptions, handler: undici.Dispatcher.DispatchHandler): boolean;
    close(): Promise<void>;
    close(callback: () => void): void;
    destroy(): Promise<void>;
    destroy(err: Error | null): Promise<void>;
    destroy(callback: () => void): void;
    destroy(err: Error | null, callback: () => void): void;
    get isMockActive(): boolean;
}

export declare const DispatchNamespaceOptionsSchema: z.ZodObject<{
    dispatchNamespaces: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        namespace: z.ZodString;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString, z.ZodTypeDef, RemoteProxyConnectionString>>;
    }, "strip", z.ZodTypeAny, {
        namespace: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }, {
        namespace: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    dispatchNamespaces?: Record<string, {
        namespace: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
}, {
    dispatchNamespaces?: Record<string, {
        namespace: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
}>;

export declare type DOContainerOptions = z.infer<typeof DOContainerOptionsSchema>;

export declare const DOContainerOptionsSchema: z.ZodObject<{
    imageName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    imageName: string;
}, {
    imageName: string;
}>;

export declare const DURABLE_OBJECTS_PLUGIN: Plugin<typeof DurableObjectsOptionsSchema, typeof DurableObjectsSharedOptionsSchema>;

export declare const DURABLE_OBJECTS_PLUGIN_NAME = "do";

export declare const DURABLE_OBJECTS_STORAGE_SERVICE_NAME = "do:storage";

export declare type DurableObjectClassNames = Map<string, Map<string, {
    enableSql?: boolean;
    unsafeUniqueKey?: UnsafeUniqueKey;
    unsafePreventEviction?: boolean;
    container?: DOContainerOptions;
}>>;

export declare const DurableObjectsOptionsSchema: z.ZodObject<{
    durableObjects: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodObject<{
        className: z.ZodString;
        scriptName: z.ZodOptional<z.ZodString>;
        useSQLite: z.ZodOptional<z.ZodBoolean>;
        unsafeUniqueKey: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<typeof kUnsafeEphemeralUniqueKey>]>>;
        unsafePreventEviction: z.ZodOptional<z.ZodBoolean>;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString, z.ZodTypeDef, RemoteProxyConnectionString>>;
        container: z.ZodOptional<z.ZodType<{
            imageName: string;
        }, z.ZodTypeDef, {
            imageName: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        className: string;
        scriptName?: string | undefined;
        useSQLite?: boolean | undefined;
        unsafeUniqueKey?: string | typeof kUnsafeEphemeralUniqueKey | undefined;
        unsafePreventEviction?: boolean | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
        container?: {
            imageName: string;
        } | undefined;
    }, {
        className: string;
        scriptName?: string | undefined;
        useSQLite?: boolean | undefined;
        unsafeUniqueKey?: string | typeof kUnsafeEphemeralUniqueKey | undefined;
        unsafePreventEviction?: boolean | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
        container?: {
            imageName: string;
        } | undefined;
    }>]>>>;
    additionalUnboundDurableObjects: z.ZodOptional<z.ZodArray<z.ZodObject<{
        className: z.ZodString;
        scriptName: z.ZodOptional<z.ZodString>;
        useSQLite: z.ZodOptional<z.ZodBoolean>;
        unsafeUniqueKey: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<typeof kUnsafeEphemeralUniqueKey>]>>;
        unsafePreventEviction: z.ZodOptional<z.ZodBoolean>;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString, z.ZodTypeDef, RemoteProxyConnectionString>>;
        container: z.ZodOptional<z.ZodType<{
            imageName: string;
        }, z.ZodTypeDef, {
            imageName: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        className: string;
        scriptName?: string | undefined;
        useSQLite?: boolean | undefined;
        unsafeUniqueKey?: string | typeof kUnsafeEphemeralUniqueKey | undefined;
        unsafePreventEviction?: boolean | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
        container?: {
            imageName: string;
        } | undefined;
    }, {
        className: string;
        scriptName?: string | undefined;
        useSQLite?: boolean | undefined;
        unsafeUniqueKey?: string | typeof kUnsafeEphemeralUniqueKey | undefined;
        unsafePreventEviction?: boolean | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
        container?: {
            imageName: string;
        } | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    durableObjects?: Record<string, string | {
        className: string;
        scriptName?: string | undefined;
        useSQLite?: boolean | undefined;
        unsafeUniqueKey?: string | typeof kUnsafeEphemeralUniqueKey | undefined;
        unsafePreventEviction?: boolean | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
        container?: {
            imageName: string;
        } | undefined;
    }> | undefined;
    additionalUnboundDurableObjects?: {
        className: string;
        scriptName?: string | undefined;
        useSQLite?: boolean | undefined;
        unsafeUniqueKey?: string | typeof kUnsafeEphemeralUniqueKey | undefined;
        unsafePreventEviction?: boolean | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
        container?: {
            imageName: string;
        } | undefined;
    }[] | undefined;
}, {
    durableObjects?: Record<string, string | {
        className: string;
        scriptName?: string | undefined;
        useSQLite?: boolean | undefined;
        unsafeUniqueKey?: string | typeof kUnsafeEphemeralUniqueKey | undefined;
        unsafePreventEviction?: boolean | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
        container?: {
            imageName: string;
        } | undefined;
    }> | undefined;
    additionalUnboundDurableObjects?: {
        className: string;
        scriptName?: string | undefined;
        useSQLite?: boolean | undefined;
        unsafeUniqueKey?: string | typeof kUnsafeEphemeralUniqueKey | undefined;
        unsafePreventEviction?: boolean | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
        container?: {
            imageName: string;
        } | undefined;
    }[] | undefined;
}>;

export declare const DurableObjectsSharedOptionsSchema: z.ZodObject<{
    durableObjectsPersist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
}, "strip", z.ZodTypeAny, {
    durableObjectsPersist?: string | boolean | undefined;
}, {
    durableObjectsPersist?: string | boolean | undefined;
}>;

export declare const EMAIL_PLUGIN: Plugin<typeof EmailOptionsSchema>;

export declare const EMAIL_PLUGIN_NAME = "email";

export declare const EmailOptionsSchema: z.ZodObject<{
    email: z.ZodOptional<z.ZodObject<{
        send_email: z.ZodOptional<z.ZodArray<z.ZodIntersection<z.ZodObject<{
            name: z.ZodString;
            remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString, z.ZodTypeDef, RemoteProxyConnectionString>>;
            allowed_sender_addresses: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
            allowed_sender_addresses?: string[] | undefined;
        }, {
            name: string;
            remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
            allowed_sender_addresses?: string[] | undefined;
        }>, z.ZodUnion<[z.ZodObject<{
            destination_address: z.ZodOptional<z.ZodString>;
            allowed_destination_addresses: z.ZodOptional<z.ZodNever>;
        }, "strip", z.ZodTypeAny, {
            destination_address?: string | undefined;
            allowed_destination_addresses?: undefined;
        }, {
            destination_address?: string | undefined;
            allowed_destination_addresses?: undefined;
        }>, z.ZodObject<{
            allowed_destination_addresses: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            destination_address: z.ZodOptional<z.ZodNever>;
        }, "strip", z.ZodTypeAny, {
            allowed_destination_addresses?: string[] | undefined;
            destination_address?: undefined;
        }, {
            allowed_destination_addresses?: string[] | undefined;
            destination_address?: undefined;
        }>]>>, "many">>;
    }, "strip", z.ZodTypeAny, {
        send_email?: ({
            name: string;
            remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
            allowed_sender_addresses?: string[] | undefined;
        } & ({
            destination_address?: string | undefined;
            allowed_destination_addresses?: undefined;
        } | {
            allowed_destination_addresses?: string[] | undefined;
            destination_address?: undefined;
        }))[] | undefined;
    }, {
        send_email?: ({
            name: string;
            remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
            allowed_sender_addresses?: string[] | undefined;
        } & ({
            destination_address?: string | undefined;
            allowed_destination_addresses?: undefined;
        } | {
            allowed_destination_addresses?: string[] | undefined;
            destination_address?: undefined;
        }))[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    email?: {
        send_email?: ({
            name: string;
            remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
            allowed_sender_addresses?: string[] | undefined;
        } & ({
            destination_address?: string | undefined;
            allowed_destination_addresses?: undefined;
        } | {
            allowed_destination_addresses?: string[] | undefined;
            destination_address?: undefined;
        }))[] | undefined;
    } | undefined;
}, {
    email?: {
        send_email?: ({
            name: string;
            remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
            allowed_sender_addresses?: string[] | undefined;
        } & ({
            destination_address?: string | undefined;
            allowed_destination_addresses?: undefined;
        } | {
            allowed_destination_addresses?: string[] | undefined;
            destination_address?: undefined;
        }))[] | undefined;
    } | undefined;
}>;

/* Excluded from this release type: _enableControlEndpoints */

export declare function encodeSitesKey(key: string): string;

export declare class ErrorEvent extends Event {
    readonly error: Error | null;
    constructor(type: "error", init?: {
        error?: Error;
    });
}

export declare interface Extension {
    modules?: Extension_Module[];
}

export declare interface Extension_Module {
    name?: string;
    internal?: boolean;
    esModule?: string;
}

export declare type ExternalServer = {
    address?: string;
} & ({
    http: HttpOptions;
} | {
    https: ExternalServer_Https;
} | {
    tcp: ExternalServer_Tcp;
});

export declare interface ExternalServer_Https {
    options?: HttpOptions;
    tlsOptions?: TlsOptions;
    certificateHost?: string;
}

export declare interface ExternalServer_Tcp {
    tlsOptions?: TlsOptions;
    certificateHost?: string;
}

declare function fetch_2(input: RequestInfo, init?: RequestInit_2 | Request_2): Promise<Response_2>;
export { fetch_2 as fetch }

export declare function _forceColour(enabled?: boolean): void;

/**
 * Format an error into a string, including the error cause if available.
 *
 * @example
 * ```
 * Error: Something went wrong
 *    at Object.<anonymous> (/path/to/file.js:10:15)
 * Caused by: Error: Another error
 *   at Object.<anonymous> (/path/to/another-file.js:5:10)
 * ```
 */
export declare function formatError(error: Error): string;

export declare function formatZodError(error: z.ZodError, input: unknown): string;

export { FormData_2 as FormData }

export declare function getAccessibleHosts(ipv4Only?: boolean): string[];

export declare function getAssetsBindingsNames(assetsKVBindingName?: string, assetsManifestBindingName?: string): {
    readonly ASSETS_KV_NAMESPACE: string;
    readonly ASSETS_MANIFEST: string;
};

export declare function getCacheServiceName(workerIndex: number): string;

/**
 * Get the default path for the dev registry.
 * This is used by both Wrangler and the Vite plugin to ensure they use the same path.
 */
export declare function getDefaultDevRegistryPath(): string;

export declare function getDirectSocketName(workerIndex: number, entrypoint: string): string;

export declare function getEntrySocketHttpOptions(coreOpts: z.infer<typeof CORE_PLUGIN.sharedOptions>): Promise<{
    http: HttpOptions;
} | {
    https: Socket_Https;
}>;

export declare function getFreshSourceMapSupport(): cspotcodeSourceMapSupport;

export declare function getGlobalServices({ sharedOptions, allWorkerRoutes, fallbackWorkerName, loopbackPort, log, proxyBindings, }: GlobalServicesOptions): Service[];

export declare function getMiniflareObjectBindings(unsafeStickyBlobs: boolean): Worker_Binding[];

/**
 * Computes the Node.js compatibility mode we are running.
 *
 * NOTES:
 * - The v2 mode is configured via `nodejs_compat_v2` compat flag or via `nodejs_compat` plus a compatibility date of Sept 23rd. 2024 or later.
 * - See `EnvironmentInheritable` for `nodeCompat` and `noBundle`.
 *
 * @param compatibilityDateStr The compatibility date
 * @param compatibilityFlags The compatibility flags
 * @returns the mode and flags to indicate specific configuration for validating.
 */
export declare function getNodeCompat(compatibilityDate: string | undefined, // Default to some arbitrary old date
compatibilityFlags: string[]): {
    mode: NodeJSCompatMode;
    hasNodejsAlsFlag: boolean;
    hasNodejsCompatFlag: boolean;
    hasNodejsCompatV2Flag: boolean;
    hasNoNodejsCompatV2Flag: boolean;
    hasExperimentalNodejsCompatV2Flag: boolean;
};

export declare function getPersistPath(pluginName: string, tmpPath: string, defaultPersistRoot: string | undefined, persist: Persistence): string;

export declare function getRootPath(opts: unknown): string;

/**
 * Utility to get the name for a service implementing a user binding
 *
 * @param scope Scope of the service (this usually is the plugin name)
 * @param identifier Identifier to use for the service
 * @param remoteProxyConnectionString Optional remote proxy connection string (in case the service connects to a remote resource)
 * @returns the name for the service
 */
export declare function getUserBindingServiceName(scope: string, identifier: string, remoteProxyConnectionString?: RemoteProxyConnectionString): string;

/**
 * Read the worker registry from the specified path.
 *
 * This function reads the worker definitions from the registry directory, and skips any stale
 * workers that have not been updated in the last 5 minutes. If a worker is stale, it will call
 * the `unregisterStaleWorker` callback if provided.
 */
export declare function getWorkerRegistry(registryPath: string, unregisterStaleWorker?: (workerName: string) => void): WorkerRegistry;

export declare interface GlobalServicesOptions {
    sharedOptions: z.infer<typeof CoreSharedOptionsSchema>;
    allWorkerRoutes: Map<string, string[]>;
    fallbackWorkerName: string | undefined;
    loopbackPort: number;
    log: Log;
    proxyBindings: Worker_Binding[];
}

export declare function globsToRegExps(globs?: string[]): MatcherRegExps;

export { Headers_2 as Headers }

export { HeadersInit }

export declare const HELLO_WORLD_PLUGIN: Plugin<typeof HelloWorldOptionsSchema, typeof HelloWorldSharedOptionsSchema>;

export declare const HELLO_WORLD_PLUGIN_NAME = "hello-world";

export declare const HelloWorldOptionsSchema: z.ZodObject<{
    helloWorld: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        enable_timer: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enable_timer?: boolean | undefined;
    }, {
        enable_timer?: boolean | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    helloWorld?: Record<string, {
        enable_timer?: boolean | undefined;
    }> | undefined;
}, {
    helloWorld?: Record<string, {
        enable_timer?: boolean | undefined;
    }> | undefined;
}>;

export declare const HelloWorldSharedOptionsSchema: z.ZodObject<{
    helloWorldPersist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
}, "strip", z.ZodTypeAny, {
    helloWorldPersist?: string | boolean | undefined;
}, {
    helloWorldPersist?: string | boolean | undefined;
}>;

export declare const HOST_CAPNP_CONNECT = "miniflare-unsafe-internal-capnp-connect";

export declare interface HttpOptions {
    style?: HttpOptions_Style;
    forwardedProtoHeader?: string;
    cfBlobHeader?: string;
    injectRequestHeaders?: HttpOptions_Header[];
    injectResponseHeaders?: HttpOptions_Header[];
    capnpConnectHost?: string;
}

export declare interface HttpOptions_Header {
    name?: string;
    value?: string;
}

export declare const HttpOptions_Style: {
    /**
     * Normal HTTP. The request line contains only the path, and the separate `Host` header
     * specifies the hostname.
     *
     */
    readonly HOST: 0;
    /**
     * HTTP proxy protocol. The request line contains a full URL instead of a path. No `Host`
     * header is required. This is the protocol used by HTTP forward proxies. This allows you to
     * implement such a proxy as a Worker.
     *
     */
    readonly PROXY: 1;
};

export declare type HttpOptions_Style = (typeof HttpOptions_Style)[keyof typeof HttpOptions_Style];

export declare const HYPERDRIVE_PLUGIN: Plugin<typeof HyperdriveInputOptionsSchema>;

export declare const HYPERDRIVE_PLUGIN_NAME = "hyperdrive";

export declare const HyperdriveInputOptionsSchema: z.ZodObject<{
    hyperdrives: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<URL_2, z.ZodTypeDef, URL_2>]>, URL_2, string | URL_2>>>;
}, "strip", z.ZodTypeAny, {
    hyperdrives?: Record<string, URL_2> | undefined;
}, {
    hyperdrives?: Record<string, string | URL_2> | undefined;
}>;

export declare interface HyperdriveProxyConfig {
    name: string;
    targetHost: string;
    targetPort: string;
    scheme: string;
    sslmode: string;
}

/**
 * HyperdriveProxyController establishes TLS-enabled connections between workerd
 * and external Postgres/MySQL databases. Supports PostgreSQL sslmode options
 * ('require', 'prefer', 'disable') by proxying each Hyperdrive binding through
 * a randomly assigned local port.
 */
export declare class HyperdriveProxyController {
    #private;
    /**
     * Creates a proxy server for a Hyperdrive binding.
     *
     * @param config - The configuration for the proxy server.
     * @returns A promise that resolves to the port number of the proxy server.
     */
    createProxyServer(config: HyperdriveProxyConfig): Promise<number>;
    /** Disposes of the proxy servers when shutting down the worker.*/
    dispose(): Promise<void>;
}

export declare const HyperdriveSchema: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<URL_2, z.ZodTypeDef, URL_2>]>, URL_2, string | URL_2>;

export declare const IMAGES_PLUGIN: Plugin<typeof ImagesOptionsSchema>;

export declare const IMAGES_PLUGIN_NAME = "images";

export declare const ImagesOptionsSchema: z.ZodObject<{
    images: z.ZodOptional<z.ZodObject<{
        binding: z.ZodString;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString, z.ZodTypeDef, RemoteProxyConnectionString>>;
    }, "strip", z.ZodTypeAny, {
        binding: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }, {
        binding: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    images?: {
        binding: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    } | undefined;
}, {
    images?: {
        binding: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    } | undefined;
}>;

export declare interface InclusiveRange {
    start: number;
    end: number;
}

/* Excluded from this release type: _initialiseInstanceRegistry */

/* Excluded from this release type: _isCyclic */

export declare function isFetcherFetch(targetName: string, key: string): boolean;

/**
 * See #createMediaProxy() comment for why this is special
 */
export declare function isImagesInput(targetName: string, key: string): boolean;

export declare function isR2ObjectWriteHttpMetadata(targetName: string, key: string): boolean;

export declare function isSitesRequest(request: {
    url: string;
}): boolean;

export declare type Json = Literal | {
    [key: string]: Json;
} | Json[];

export declare interface JsonError {
    message?: string;
    name?: string;
    stack?: string;
    cause?: JsonError;
}

export declare const JsonSchema: z.ZodType<Json>;

declare const kAccepted: unique symbol;

declare const kCf: unique symbol;

declare const kClose: unique symbol;

declare const kClosedIncoming: unique symbol;

declare const kClosedOutgoing: unique symbol;

declare const kCoupled: unique symbol;

export declare const kCurrentWorker: unique symbol;

declare const kError: unique symbol;

export declare type KeyTypes<T> = T extends Set<infer Keys> ? Keys : never;

export declare const kInspectorSocket: unique symbol;

declare const kPair: unique symbol;

declare const kSend: unique symbol;

export declare const kUnsafeEphemeralUniqueKey: unique symbol;

export declare const KV_NAMESPACE_OBJECT_CLASS_NAME = "KVNamespaceObject";

export declare const KV_PLUGIN: Plugin<typeof KVOptionsSchema, typeof KVSharedOptionsSchema>;

export declare const KV_PLUGIN_NAME = "kv";

export declare const KVHeaders: {
    readonly EXPIRATION: "CF-Expiration";
    readonly METADATA: "CF-KV-Metadata";
};

export declare const KVLimits: {
    readonly MIN_CACHE_TTL: 60;
    readonly MAX_LIST_KEYS: 1000;
    readonly MAX_KEY_SIZE: 512;
    readonly MAX_VALUE_SIZE: number;
    readonly MAX_VALUE_SIZE_TEST: 1024;
    readonly MAX_METADATA_SIZE: 1024;
    readonly MAX_BULK_SIZE: number;
};

export declare const kVoid: unique symbol;

export declare const KVOptionsSchema: z.ZodObject<{
    kvNamespaces: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodString>, z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString, z.ZodTypeDef, RemoteProxyConnectionString>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }, {
        id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }>>, z.ZodArray<z.ZodString, "many">]>>;
    sitePath: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    siteInclude: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    siteExclude: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    kvNamespaces?: string[] | Record<string, string> | Record<string, {
        id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
    sitePath?: string | undefined;
    siteInclude?: string[] | undefined;
    siteExclude?: string[] | undefined;
}, {
    kvNamespaces?: string[] | Record<string, string> | Record<string, {
        id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
    sitePath?: string | undefined;
    siteInclude?: string[] | undefined;
    siteExclude?: string[] | undefined;
}>;

export declare const KVParams: {
    readonly URL_ENCODED: "urlencoded";
    readonly CACHE_TTL: "cache_ttl";
    readonly EXPIRATION: "expiration";
    readonly EXPIRATION_TTL: "expiration_ttl";
    readonly LIST_LIMIT: "key_count_limit";
    readonly LIST_PREFIX: "prefix";
    readonly LIST_CURSOR: "cursor";
};

export declare const KVSharedOptionsSchema: z.ZodObject<{
    kvPersist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
}, "strip", z.ZodTypeAny, {
    kvPersist?: string | boolean | undefined;
}, {
    kvPersist?: string | boolean | undefined;
}>;

declare const kWebSocket: unique symbol;

export declare function launchBrowser({ browserVersion, log, tmpPath, }: {
    browserVersion: string;
    log: Log;
    tmpPath: string;
}): Promise<{
    sessionId: `${string}-${string}-${string}-${string}-${string}`;
    browserProcess: Process;
    startTime: number;
    wsEndpoint: string;
}>;

export declare type Literal = z.infer<typeof LiteralSchema>;

export declare const LiteralSchema: z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;

/**
 * loadExternalPlugins will take a packageName, and attempt to load additional
 * external plugins to add to Miniflare's default ones
 */
export declare function loadExternalPlugins(packageName: string): Promise<Record<string, Plugin<z.AnyZodObject>>>;

export declare class Log {
    #private;
    readonly level: LogLevel;
    constructor(level?: LogLevel, opts?: LogOptions);
    protected log(message: string): void;
    static unstable_registerBeforeLogHook(callback: (() => void) | undefined): void;
    static unstable_registerAfterLogHook(callback: (() => void) | undefined): void;
    logWithLevel(level: LogLevel, message: string): void;
    logReady(message: string): void;
    error(message: Error): void;
    warn(message: string): void;
    info(message: string): void;
    debug(message: string): void;
    verbose(message: string): void;
}

export declare enum LogLevel {
    NONE = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4,
    VERBOSE = 5
}

export declare interface LogOptions {
    prefix?: string;
    suffix?: string;
}

export declare type ManifestEntry = {
    pathHash: Uint8Array;
    contentHash: Uint8Array;
};

export declare interface MatcherRegExps {
    include: RegExp[];
    exclude: RegExp[];
}

export declare function matchRoutes(routes: WorkerRoute[], url: URL): string | null;

export declare const MAX_BULK_GET_KEYS = 100;

export declare function maybeApply<From, To>(f: (value: From) => To, maybeValue: From | undefined): To | undefined;

export declare function maybeParseURL(url: Persistence): URL | undefined;

export declare const MEDIA_PLUGIN: Plugin<typeof MediaOptionsSchema>;

export declare const MEDIA_PLUGIN_NAME = "media";

export declare const MediaOptionsSchema: z.ZodObject<{
    media: z.ZodOptional<z.ZodObject<{
        binding: z.ZodString;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString, z.ZodTypeDef, RemoteProxyConnectionString>>;
    }, "strip", z.ZodTypeAny, {
        binding: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }, {
        binding: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    media?: {
        binding: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    } | undefined;
}, {
    media?: {
        binding: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    } | undefined;
}>;

/**
 * Merges all of `b`'s properties into `a`. Only merges 1 level deep, i.e.
 * `kvNamespaces` will be fully-merged, but `durableObject` object-designators
 * will be overwritten.
 */
export declare function mergeWorkerOptions(a: Partial<WorkerOptions>, b: Partial<WorkerOptions>): Partial<WorkerOptions>;

declare class MessageEvent_2 extends Event {
    readonly data: string | ArrayBuffer | Uint8Array<ArrayBuffer>;
    constructor(type: "message", init: {
        data: string | ArrayBuffer | Uint8Array<ArrayBuffer>;
    });
}
export { MessageEvent_2 as MessageEvent }

export declare function migrateDatabase(log: Log, uniqueKey: string, persistPath: string, namespace: string): Promise<void>;

export declare class Miniflare {
    #private;
    constructor(opts: MiniflareOptions);
    get ready(): Promise<URL>;
    getCf(): Promise<Record<string, any>>;
    getInspectorURL(): Promise<URL>;
    unsafeGetDirectURL(workerName?: string, entrypoint?: string): Promise<URL>;
    setOptions(opts: MiniflareOptions): Promise<void>;
    dispatchFetch: DispatchFetch;
    /* Excluded from this release type: _getProxyClient */
    getBindings<Env = Record<string, unknown>>(workerName?: string): Promise<Env>;
    getWorker(workerName?: string): Promise<ReplaceWorkersTypes<Fetcher>>;
    getCaches(): Promise<ReplaceWorkersTypes<CacheStorage>>;
    getD1Database(bindingName: string, workerName?: string): Promise<D1Database>;
    getDurableObjectNamespace(bindingName: string, workerName?: string): Promise<ReplaceWorkersTypes<DurableObjectNamespace>>;
    getKVNamespace(bindingName: string, workerName?: string): Promise<ReplaceWorkersTypes<KVNamespace>>;
    getSecretsStoreSecretAPI(bindingName: string, workerName?: string): Promise<() => {
        create: (value: string) => Promise<string>;
        update: (value: string, id: string) => Promise<string>;
        duplicate: (id: string, newName: string) => Promise<string>;
        delete: (id: string) => Promise<void>;
        list: () => Promise<KVNamespaceListKey<{
            uuid: string;
        }, string>[]>;
        get: (id: string) => Promise<string>;
    }>;
    getSecretsStoreSecret(bindingName: string, workerName?: string): Promise<ReplaceWorkersTypes<KVNamespace>>;
    getQueueProducer<Body = unknown>(bindingName: string, workerName?: string): Promise<Queue<Body>>;
    getR2Bucket(bindingName: string, workerName?: string): Promise<ReplaceWorkersTypes<R2Bucket>>;
    getHelloWorldBinding(bindingName: string, workerName?: string): Promise<{
        get: () => Promise<{
            value: string;
            ms?: number;
        }>;
        set: (value: string) => Promise<void>;
    }>;
    /* Excluded from this release type: _getInternalDurableObjectNamespace */
    unsafeGetPersistPaths(): Map<keyof Plugins, string>;
    dispose(): Promise<void>;
}

export declare class MiniflareCoreError extends MiniflareError<MiniflareCoreErrorCode> {
}

export declare type MiniflareCoreErrorCode = KeyTypes<typeof USER_ERROR_CODES> | KeyTypes<typeof SYSTEM_ERROR_CODES>;

export declare class MiniflareError<Code extends string = string> extends Error {
    readonly code: Code;
    readonly cause?: Error | undefined;
    constructor(code: Code, message?: string, cause?: Error | undefined);
    isUserError(): boolean;
    isSystemError(): boolean;
}

export declare type MiniflareOptions = SharedOptions & (WorkerOptions | {
    workers: WorkerOptions[];
});

export declare type ModuleDefinition = z.infer<typeof ModuleDefinitionSchema>;

export declare const ModuleDefinitionSchema: z.ZodObject<{
    type: z.ZodEnum<["ESModule", "CommonJS", "Text", "Data", "CompiledWasm", "PythonModule", "PythonRequirement"]>;
    path: z.ZodEffects<z.ZodString, string, string>;
    contents: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodType<Uint8Array<ArrayBuffer>, z.ZodTypeDef, Uint8Array<ArrayBuffer>>]>>;
}, "strip", z.ZodTypeAny, {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    path: string;
    contents?: string | Uint8Array<ArrayBuffer> | undefined;
}, {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    path: string;
    contents?: string | Uint8Array<ArrayBuffer> | undefined;
}>;

export declare type ModuleRule = z.infer<typeof ModuleRuleSchema>;

export declare const ModuleRuleSchema: z.ZodObject<{
    type: z.ZodEnum<["ESModule", "CommonJS", "Text", "Data", "CompiledWasm", "PythonModule", "PythonRequirement"]>;
    include: z.ZodArray<z.ZodString, "many">;
    fallthrough: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    include: string[];
    fallthrough?: boolean | undefined;
}, {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    include: string[];
    fallthrough?: boolean | undefined;
}>;

export declare type ModuleRuleType = z.infer<typeof ModuleRuleTypeSchema>;

export declare const ModuleRuleTypeSchema: z.ZodEnum<["ESModule", "CommonJS", "Text", "Data", "CompiledWasm", "PythonModule", "PythonRequirement"]>;

export declare const MTLS_PLUGIN: Plugin<typeof MtlsOptionsSchema>;

export declare const MTLS_PLUGIN_NAME = "mtls";

export declare const MtlsOptionsSchema: z.ZodObject<{
    mtlsCertificates: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        certificate_id: z.ZodString;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString, z.ZodTypeDef, RemoteProxyConnectionString>>;
    }, "strip", z.ZodTypeAny, {
        certificate_id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }, {
        certificate_id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    mtlsCertificates?: Record<string, {
        certificate_id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
}, {
    mtlsCertificates?: Record<string, {
        certificate_id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
}>;

export declare class Mutex {
    private locked;
    private resolveQueue;
    private drainQueue;
    private lock;
    private unlock;
    get hasWaiting(): boolean;
    runWith<T>(closure: () => Awaitable<T>): Promise<T>;
    drained(): Promise<void>;
}

export declare function namespaceEntries(namespaces?: Record<string, string | {
    id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString;
}> | string[]): [
bindingName: string,
    {
    id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString;
}
][];

export declare function namespaceKeys(namespaces?: Record<string, unknown> | string[]): string[];

export declare interface Network {
    allow?: string[];
    deny?: string[];
    tlsOptions?: TlsOptions;
}

export declare const NODE_PLATFORM_IMPL: PlatformImpl<ReadableStream_3>;

/**
 * We can provide Node.js compatibility in a number of different modes:
 * - "als": this mode tells the workerd runtime to enable only the Async Local Storage builtin library (accessible via `node:async_hooks`).
 * - "v1" - this mode tells the workerd runtime to enable some Node.js builtin libraries (accessible only via `node:...` imports) but no globals.
 * - "v2" - this mode tells the workerd runtime to enable more Node.js builtin libraries (accessible both with and without the `node:` prefix)
 *   and also some Node.js globals such as `Buffer`; it also turns on additional compile-time polyfills for those that are not provided by the runtime.
 *  - null - no Node.js compatibility.
 */
export declare type NodeJSCompatMode = "als" | "v1" | "v2" | null;

export declare class NoOpLog extends Log {
    constructor();
    protected log(): void;
    error(_message: Error): void;
}

export declare function normaliseDurableObject(designator: NonNullable<z.infer<typeof DurableObjectsOptionsSchema>["durableObjects"]>[string]): {
    className: string;
    scriptName: string | undefined;
    serviceName: string | undefined;
    enableSql: boolean | undefined;
    unsafeUniqueKey: UnsafeUniqueKey | undefined;
    unsafePreventEviction: boolean | undefined;
    remoteProxyConnectionString: RemoteProxyConnectionString | undefined;
    container: DOContainerOptions | undefined;
};

export declare function objectEntryWorker(durableObjectNamespace: Worker_Binding_DurableObjectNamespaceDesignator, namespace: string): Worker;

export declare type OptionalZodTypeOf<T extends z.ZodTypeAny | undefined> = T extends z.ZodTypeAny ? z.TypeOf<T> : undefined;

export declare type OverloadReplaceWorkersTypes<T> = T extends (...args: any[]) => any ? UnionToIntersection<ReplaceWorkersTypes<OverloadUnion<T>>> : ReplaceWorkersTypes<T>;

export declare type OverloadUnion<T extends (...args: any[]) => any> = Parameters<T> extends [] ? T : OverloadUnion14<T>;

export declare type OverloadUnion10<T> = T extends {
    (...args: infer P1): infer R1;
    (...args: infer P2): infer R2;
    (...args: infer P3): infer R3;
    (...args: infer P4): infer R4;
    (...args: infer P5): infer R5;
    (...args: infer P6): infer R6;
    (...args: infer P7): infer R7;
    (...args: infer P8): infer R8;
    (...args: infer P9): infer R9;
    (...args: infer P10): infer R10;
} ? ((...args: P1) => R1) | ((...args: P2) => R2) | ((...args: P3) => R3) | ((...args: P4) => R4) | ((...args: P5) => R5) | ((...args: P6) => R6) | ((...args: P7) => R7) | ((...args: P8) => R8) | ((...args: P9) => R9) | ((...args: P10) => R10) : OverloadUnion9<T>;

export declare type OverloadUnion11<T> = T extends {
    (...args: infer P1): infer R1;
    (...args: infer P2): infer R2;
    (...args: infer P3): infer R3;
    (...args: infer P4): infer R4;
    (...args: infer P5): infer R5;
    (...args: infer P6): infer R6;
    (...args: infer P7): infer R7;
    (...args: infer P8): infer R8;
    (...args: infer P9): infer R9;
    (...args: infer P10): infer R10;
    (...args: infer P11): infer R11;
} ? ((...args: P1) => R1) | ((...args: P2) => R2) | ((...args: P3) => R3) | ((...args: P4) => R4) | ((...args: P5) => R5) | ((...args: P6) => R6) | ((...args: P7) => R7) | ((...args: P8) => R8) | ((...args: P9) => R9) | ((...args: P10) => R10) | ((...args: P11) => R11) : OverloadUnion10<T>;

export declare type OverloadUnion12<T> = T extends {
    (...args: infer P1): infer R1;
    (...args: infer P2): infer R2;
    (...args: infer P3): infer R3;
    (...args: infer P4): infer R4;
    (...args: infer P5): infer R5;
    (...args: infer P6): infer R6;
    (...args: infer P7): infer R7;
    (...args: infer P8): infer R8;
    (...args: infer P9): infer R9;
    (...args: infer P10): infer R10;
    (...args: infer P11): infer R11;
    (...args: infer P12): infer R12;
} ? ((...args: P1) => R1) | ((...args: P2) => R2) | ((...args: P3) => R3) | ((...args: P4) => R4) | ((...args: P5) => R5) | ((...args: P6) => R6) | ((...args: P7) => R7) | ((...args: P8) => R8) | ((...args: P9) => R9) | ((...args: P10) => R10) | ((...args: P11) => R11) | ((...args: P12) => R12) : OverloadUnion11<T>;

export declare type OverloadUnion13<T> = T extends {
    (...args: infer P1): infer R1;
    (...args: infer P2): infer R2;
    (...args: infer P3): infer R3;
    (...args: infer P4): infer R4;
    (...args: infer P5): infer R5;
    (...args: infer P6): infer R6;
    (...args: infer P7): infer R7;
    (...args: infer P8): infer R8;
    (...args: infer P9): infer R9;
    (...args: infer P10): infer R10;
    (...args: infer P11): infer R11;
    (...args: infer P12): infer R12;
    (...args: infer P13): infer R13;
} ? ((...args: P1) => R1) | ((...args: P2) => R2) | ((...args: P3) => R3) | ((...args: P4) => R4) | ((...args: P5) => R5) | ((...args: P6) => R6) | ((...args: P7) => R7) | ((...args: P8) => R8) | ((...args: P9) => R9) | ((...args: P10) => R10) | ((...args: P11) => R11) | ((...args: P12) => R12) | ((...args: P13) => R13) : OverloadUnion12<T>;

export declare type OverloadUnion14<T> = T extends {
    (...args: infer P1): infer R1;
    (...args: infer P2): infer R2;
    (...args: infer P3): infer R3;
    (...args: infer P4): infer R4;
    (...args: infer P5): infer R5;
    (...args: infer P6): infer R6;
    (...args: infer P7): infer R7;
    (...args: infer P8): infer R8;
    (...args: infer P9): infer R9;
    (...args: infer P10): infer R10;
    (...args: infer P11): infer R11;
    (...args: infer P12): infer R12;
    (...args: infer P13): infer R13;
    (...args: infer P14): infer R14;
} ? ((...args: P1) => R1) | ((...args: P2) => R2) | ((...args: P3) => R3) | ((...args: P4) => R4) | ((...args: P5) => R5) | ((...args: P6) => R6) | ((...args: P7) => R7) | ((...args: P8) => R8) | ((...args: P9) => R9) | ((...args: P10) => R10) | ((...args: P11) => R11) | ((...args: P12) => R12) | ((...args: P13) => R13) | ((...args: P14) => R14) : OverloadUnion13<T>;

export declare type OverloadUnion2<T> = T extends {
    (...args: infer P1): infer R1;
    (...args: infer P2): infer R2;
} ? ((...args: P1) => R1) | ((...args: P2) => R2) : T;

export declare type OverloadUnion3<T> = T extends {
    (...args: infer P1): infer R1;
    (...args: infer P2): infer R2;
    (...args: infer P3): infer R3;
} ? ((...args: P1) => R1) | ((...args: P2) => R2) | ((...args: P3) => R3) : OverloadUnion2<T>;

export declare type OverloadUnion4<T> = T extends {
    (...args: infer P1): infer R1;
    (...args: infer P2): infer R2;
    (...args: infer P3): infer R3;
    (...args: infer P4): infer R4;
} ? ((...args: P1) => R1) | ((...args: P2) => R2) | ((...args: P3) => R3) | ((...args: P4) => R4) : OverloadUnion3<T>;

export declare type OverloadUnion5<T> = T extends {
    (...args: infer P1): infer R1;
    (...args: infer P2): infer R2;
    (...args: infer P3): infer R3;
    (...args: infer P4): infer R4;
    (...args: infer P5): infer R5;
} ? ((...args: P1) => R1) | ((...args: P2) => R2) | ((...args: P3) => R3) | ((...args: P4) => R4) | ((...args: P5) => R5) : OverloadUnion4<T>;

export declare type OverloadUnion6<T> = T extends {
    (...args: infer P1): infer R1;
    (...args: infer P2): infer R2;
    (...args: infer P3): infer R3;
    (...args: infer P4): infer R4;
    (...args: infer P5): infer R5;
    (...args: infer P6): infer R6;
} ? ((...args: P1) => R1) | ((...args: P2) => R2) | ((...args: P3) => R3) | ((...args: P4) => R4) | ((...args: P5) => R5) | ((...args: P6) => R6) : OverloadUnion5<T>;

export declare type OverloadUnion7<T> = T extends {
    (...args: infer P1): infer R1;
    (...args: infer P2): infer R2;
    (...args: infer P3): infer R3;
    (...args: infer P4): infer R4;
    (...args: infer P5): infer R5;
    (...args: infer P6): infer R6;
    (...args: infer P7): infer R7;
} ? ((...args: P1) => R1) | ((...args: P2) => R2) | ((...args: P3) => R3) | ((...args: P4) => R4) | ((...args: P5) => R5) | ((...args: P6) => R6) | ((...args: P7) => R7) : OverloadUnion6<T>;

export declare type OverloadUnion8<T> = T extends {
    (...args: infer P1): infer R1;
    (...args: infer P2): infer R2;
    (...args: infer P3): infer R3;
    (...args: infer P4): infer R4;
    (...args: infer P5): infer R5;
    (...args: infer P6): infer R6;
    (...args: infer P7): infer R7;
    (...args: infer P8): infer R8;
} ? ((...args: P1) => R1) | ((...args: P2) => R2) | ((...args: P3) => R3) | ((...args: P4) => R4) | ((...args: P5) => R5) | ((...args: P6) => R6) | ((...args: P7) => R7) | ((...args: P8) => R8) : OverloadUnion7<T>;

export declare type OverloadUnion9<T> = T extends {
    (...args: infer P1): infer R1;
    (...args: infer P2): infer R2;
    (...args: infer P3): infer R3;
    (...args: infer P4): infer R4;
    (...args: infer P5): infer R5;
    (...args: infer P6): infer R6;
    (...args: infer P7): infer R7;
    (...args: infer P8): infer R8;
    (...args: infer P9): infer R9;
} ? ((...args: P1) => R1) | ((...args: P2) => R2) | ((...args: P3) => R3) | ((...args: P4) => R4) | ((...args: P5) => R5) | ((...args: P6) => R6) | ((...args: P7) => R7) | ((...args: P8) => R8) | ((...args: P9) => R9) : OverloadUnion8<T>;

/**
 * Parses an HTTP `Range` header (https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range),
 * returning either:
 * - `undefined` indicating the range is unsatisfiable
 * - An empty array indicating the entire response should be returned
 * - A non-empty array of inclusive ranges of the response to return
 */
export declare function parseRanges(rangeHeader: string, length: number): InclusiveRange[] | undefined;

export declare function parseRoutes(allRoutes: Map<string, string[]>): WorkerRoute[];

export declare function parseWithReadableStreams<RS>(impl: PlatformImpl<RS>, stringified: StringifiedWithStream<RS>, revivers: ReducersRevivers): unknown;

export declare function parseWithRootPath<Z extends z.ZodTypeAny>(newRootPath: string, schema: Z, data: unknown, params?: Partial<ParseParams>): z.infer<Z>;

export declare const PathSchema: z.ZodEffects<z.ZodString, string, string>;

export declare enum PeriodType {
    TENSECONDS = 10,
    MINUTE = 60
}

export declare type Persistence = z.infer<typeof PersistenceSchema>;

export declare const PersistenceSchema: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;

export declare const PIPELINE_PLUGIN: Plugin<typeof PipelineOptionsSchema>;

export declare const PipelineOptionsSchema: z.ZodObject<{
    pipelines: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodString>, z.ZodArray<z.ZodString, "many">, z.ZodRecord<z.ZodString, z.ZodObject<{
        pipeline: z.ZodString;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString, z.ZodTypeDef, RemoteProxyConnectionString>>;
    }, "strip", z.ZodTypeAny, {
        pipeline: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }, {
        pipeline: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }>>]>>;
}, "strip", z.ZodTypeAny, {
    pipelines?: string[] | Record<string, string> | Record<string, {
        pipeline: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
}, {
    pipelines?: string[] | Record<string, string> | Record<string, {
        pipeline: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
}>;

export declare const PIPELINES_PLUGIN_NAME = "pipelines";

export declare interface PlatformImpl<RS> {
    Blob: typeof Blob_2;
    File: typeof File_2;
    Headers: typeof Headers_3;
    Request: typeof Request_5;
    Response: typeof Response_5;
    isReadableStream(value: unknown): value is RS;
    bufferReadableStream(stream: RS): Promise<ArrayBuffer>;
    unbufferReadableStream(buffer: ArrayBuffer): RS;
}

export declare type Plugin<Options extends z.ZodType, SharedOptions extends z.ZodType | undefined = undefined> = PluginBase<Options, SharedOptions> & (SharedOptions extends undefined ? {
    sharedOptions?: undefined;
} : {
    sharedOptions: SharedOptions;
});

export declare const PLUGIN_ENTRIES: [keyof Plugins, ValueOf<Plugins>][];

export declare interface PluginBase<Options extends z.ZodType, SharedOptions extends z.ZodType | undefined> {
    options: Options;
    getBindings(options: z.infer<Options>, workerIndex: number): Awaitable<Worker_Binding[] | void>;
    getNodeBindings(options: z.infer<Options>): Awaitable<Record<string, unknown>>;
    getServices(options: PluginServicesOptions<Options, SharedOptions>): Awaitable<Service[] | ServicesExtensions | void>;
    getPersistPath?(sharedOptions: OptionalZodTypeOf<SharedOptions>, tmpPath: string): string;
    getExtensions?(options: {
        options: z.infer<Options>[];
    }): Awaitable<Extension[]>;
}

export declare const PLUGINS: {
    core: Plugin_2<z.ZodEffects<z.ZodIntersection<z.ZodUnion<[z.ZodObject<{
    modules: z.ZodArray<z.ZodObject<{
    type: z.ZodEnum<["ESModule", "CommonJS", "Text", "Data", "CompiledWasm", "PythonModule", "PythonRequirement"]>;
    path: z.ZodEffects<z.ZodString, string, string>;
    contents: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodType<Uint8Array<ArrayBuffer>, z.ZodTypeDef, Uint8Array<ArrayBuffer>>]>>;
    }, "strip", z.ZodTypeAny, {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    path: string;
    contents?: string | Uint8Array<ArrayBuffer> | undefined;
    }, {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    path: string;
    contents?: string | Uint8Array<ArrayBuffer> | undefined;
    }>, "many">;
    modulesRoot: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    }, "strip", z.ZodTypeAny, {
    modules: {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    path: string;
    contents?: string | Uint8Array<ArrayBuffer> | undefined;
    }[];
    modulesRoot?: string | undefined;
    }, {
    modules: {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    path: string;
    contents?: string | Uint8Array<ArrayBuffer> | undefined;
    }[];
    modulesRoot?: string | undefined;
    }>, z.ZodObject<{
    script: z.ZodString;
    scriptPath: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    modules: z.ZodOptional<z.ZodBoolean>;
    modulesRules: z.ZodOptional<z.ZodArray<z.ZodObject<{
    type: z.ZodEnum<["ESModule", "CommonJS", "Text", "Data", "CompiledWasm", "PythonModule", "PythonRequirement"]>;
    include: z.ZodArray<z.ZodString, "many">;
    fallthrough: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    include: string[];
    fallthrough?: boolean | undefined;
    }, {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    include: string[];
    fallthrough?: boolean | undefined;
    }>, "many">>;
    modulesRoot: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    }, "strip", z.ZodTypeAny, {
    script: string;
    scriptPath?: string | undefined;
    modules?: boolean | undefined;
    modulesRules?: {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    include: string[];
    fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
    }, {
    script: string;
    scriptPath?: string | undefined;
    modules?: boolean | undefined;
    modulesRules?: {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    include: string[];
    fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
    }>, z.ZodObject<{
    scriptPath: z.ZodEffects<z.ZodString, string, string>;
    modules: z.ZodOptional<z.ZodBoolean>;
    modulesRules: z.ZodOptional<z.ZodArray<z.ZodObject<{
    type: z.ZodEnum<["ESModule", "CommonJS", "Text", "Data", "CompiledWasm", "PythonModule", "PythonRequirement"]>;
    include: z.ZodArray<z.ZodString, "many">;
    fallthrough: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    include: string[];
    fallthrough?: boolean | undefined;
    }, {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    include: string[];
    fallthrough?: boolean | undefined;
    }>, "many">>;
    modulesRoot: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    }, "strip", z.ZodTypeAny, {
    scriptPath: string;
    modules?: boolean | undefined;
    modulesRules?: {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    include: string[];
    fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
    }, {
    scriptPath: string;
    modules?: boolean | undefined;
    modulesRules?: {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    include: string[];
    fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
    }>]>, z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    rootPath: z.ZodOptional<z.ZodEffects<z.ZodString, undefined, string>>;
    compatibilityDate: z.ZodOptional<z.ZodString>;
    compatibilityFlags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    unsafeInspectorProxy: z.ZodOptional<z.ZodBoolean>;
    routes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    bindings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<Json_2, z.ZodTypeDef, Json_2>>>;
    wasmBindings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodType<Uint8Array<ArrayBuffer>, z.ZodTypeDef, Uint8Array<ArrayBuffer>>]>>>;
    textBlobBindings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodEffects<z.ZodString, string, string>>>;
    dataBlobBindings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodType<Uint8Array<ArrayBuffer>, z.ZodTypeDef, Uint8Array<ArrayBuffer>>]>>>;
    serviceBindings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodLiteral<kCurrentWorker_2>, z.ZodObject<{
    name: z.ZodUnion<[z.ZodString, z.ZodLiteral<kCurrentWorker_2>]>;
    entrypoint: z.ZodOptional<z.ZodString>;
    props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>, z.ZodObject<{
    network: z.ZodObject<{
    allow: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    deny: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    tlsOptions: z.ZodOptional<z.ZodObject<{
    keypair: z.ZodOptional<z.ZodObject<{
    privateKey: z.ZodOptional<z.ZodString>;
    certificateChain: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    }, {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    }>>;
    requireClientCerts: z.ZodOptional<z.ZodBoolean>;
    trustBrowserCas: z.ZodOptional<z.ZodBoolean>;
    trustedCertificates: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    minVersion: z.ZodOptional<z.ZodNativeEnum<{
    readonly GOOD_DEFAULT: 0;
    readonly SSL3: 1;
    readonly TLS1DOT0: 2;
    readonly TLS1DOT1: 3;
    readonly TLS1DOT2: 4;
    readonly TLS1DOT3: 5;
    }>>;
    cipherList: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    }, {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    }>>;
    }, "strip", z.ZodTypeAny, {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    }, {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    }>;
    }, "strip", z.ZodTypeAny, {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    }, {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    }>, z.ZodObject<{
    external: z.ZodType<ExternalServer_3, z.ZodTypeDef, ExternalServer_3>;
    }, "strip", z.ZodTypeAny, {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    }, {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    }>, z.ZodObject<{
    disk: z.ZodObject<{
    path: z.ZodString;
    writable: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
    path: string;
    writable?: boolean | undefined;
    }, {
    path: string;
    writable?: boolean | undefined;
    }>;
    }, "strip", z.ZodTypeAny, {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    }, {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    }>, z.ZodObject<{
    node: z.ZodType<(req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>, z.ZodTypeDef, (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>>;
    }, "strip", z.ZodTypeAny, {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    }, {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    }>, z.ZodType<(request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>, z.ZodTypeDef, (request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>>]>>>;
    wrappedBindings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodObject<{
    scriptName: z.ZodString;
    entrypoint: z.ZodOptional<z.ZodString>;
    bindings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<Json_2, z.ZodTypeDef, Json_2>>>;
    }, "strip", z.ZodTypeAny, {
    scriptName: string;
    entrypoint?: string | undefined;
    bindings?: Record<string, Json_2> | undefined;
    }, {
    scriptName: string;
    entrypoint?: string | undefined;
    bindings?: Record<string, Json_2> | undefined;
    }>]>>>;
    outboundService: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<kCurrentWorker_2>, z.ZodObject<{
    name: z.ZodUnion<[z.ZodString, z.ZodLiteral<kCurrentWorker_2>]>;
    entrypoint: z.ZodOptional<z.ZodString>;
    props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>, z.ZodObject<{
    network: z.ZodObject<{
    allow: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    deny: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    tlsOptions: z.ZodOptional<z.ZodObject<{
    keypair: z.ZodOptional<z.ZodObject<{
    privateKey: z.ZodOptional<z.ZodString>;
    certificateChain: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    }, {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    }>>;
    requireClientCerts: z.ZodOptional<z.ZodBoolean>;
    trustBrowserCas: z.ZodOptional<z.ZodBoolean>;
    trustedCertificates: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    minVersion: z.ZodOptional<z.ZodNativeEnum<{
    readonly GOOD_DEFAULT: 0;
    readonly SSL3: 1;
    readonly TLS1DOT0: 2;
    readonly TLS1DOT1: 3;
    readonly TLS1DOT2: 4;
    readonly TLS1DOT3: 5;
    }>>;
    cipherList: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    }, {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    }>>;
    }, "strip", z.ZodTypeAny, {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    }, {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    }>;
    }, "strip", z.ZodTypeAny, {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    }, {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    }>, z.ZodObject<{
    external: z.ZodType<ExternalServer_3, z.ZodTypeDef, ExternalServer_3>;
    }, "strip", z.ZodTypeAny, {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    }, {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    }>, z.ZodObject<{
    disk: z.ZodObject<{
    path: z.ZodString;
    writable: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
    path: string;
    writable?: boolean | undefined;
    }, {
    path: string;
    writable?: boolean | undefined;
    }>;
    }, "strip", z.ZodTypeAny, {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    }, {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    }>, z.ZodObject<{
    node: z.ZodType<(req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>, z.ZodTypeDef, (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>>;
    }, "strip", z.ZodTypeAny, {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    }, {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    }>, z.ZodType<(request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>, z.ZodTypeDef, (request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>>]>>;
    fetchMock: z.ZodOptional<z.ZodType<MockAgent<MockAgent>, z.ZodTypeDef, MockAgent<MockAgent>>>;
    unsafeEphemeralDurableObjects: z.ZodOptional<z.ZodBoolean>;
    unsafeDirectSockets: z.ZodOptional<z.ZodArray<z.ZodObject<{
    host: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
    serviceName: z.ZodOptional<z.ZodString>;
    entrypoint: z.ZodOptional<z.ZodString>;
    proxy: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
    host?: string | undefined;
    port?: number | undefined;
    serviceName?: string | undefined;
    entrypoint?: string | undefined;
    proxy?: boolean | undefined;
    }, {
    host?: string | undefined;
    port?: number | undefined;
    serviceName?: string | undefined;
    entrypoint?: string | undefined;
    proxy?: boolean | undefined;
    }>, "many">>;
    unsafeEvalBinding: z.ZodOptional<z.ZodString>;
    unsafeUseModuleFallbackService: z.ZodOptional<z.ZodBoolean>;
    hasAssetsAndIsVitest: z.ZodOptional<z.ZodBoolean>;
    tails: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodLiteral<kCurrentWorker_2>, z.ZodObject<{
    name: z.ZodUnion<[z.ZodString, z.ZodLiteral<kCurrentWorker_2>]>;
    entrypoint: z.ZodOptional<z.ZodString>;
    props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>, z.ZodObject<{
    network: z.ZodObject<{
    allow: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    deny: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    tlsOptions: z.ZodOptional<z.ZodObject<{
    keypair: z.ZodOptional<z.ZodObject<{
    privateKey: z.ZodOptional<z.ZodString>;
    certificateChain: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    }, {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    }>>;
    requireClientCerts: z.ZodOptional<z.ZodBoolean>;
    trustBrowserCas: z.ZodOptional<z.ZodBoolean>;
    trustedCertificates: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    minVersion: z.ZodOptional<z.ZodNativeEnum<{
    readonly GOOD_DEFAULT: 0;
    readonly SSL3: 1;
    readonly TLS1DOT0: 2;
    readonly TLS1DOT1: 3;
    readonly TLS1DOT2: 4;
    readonly TLS1DOT3: 5;
    }>>;
    cipherList: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    }, {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    }>>;
    }, "strip", z.ZodTypeAny, {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    }, {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    }>;
    }, "strip", z.ZodTypeAny, {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    }, {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    }>, z.ZodObject<{
    external: z.ZodType<ExternalServer_3, z.ZodTypeDef, ExternalServer_3>;
    }, "strip", z.ZodTypeAny, {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    }, {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    }>, z.ZodObject<{
    disk: z.ZodObject<{
    path: z.ZodString;
    writable: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
    path: string;
    writable?: boolean | undefined;
    }, {
    path: string;
    writable?: boolean | undefined;
    }>;
    }, "strip", z.ZodTypeAny, {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    }, {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    }>, z.ZodObject<{
    node: z.ZodType<(req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>, z.ZodTypeDef, (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>>;
    }, "strip", z.ZodTypeAny, {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    }, {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    }>, z.ZodType<(request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>, z.ZodTypeDef, (request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>>]>, "many">>;
    streamingTails: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodLiteral<kCurrentWorker_2>, z.ZodObject<{
    name: z.ZodUnion<[z.ZodString, z.ZodLiteral<kCurrentWorker_2>]>;
    entrypoint: z.ZodOptional<z.ZodString>;
    props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>, z.ZodObject<{
    network: z.ZodObject<{
    allow: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    deny: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    tlsOptions: z.ZodOptional<z.ZodObject<{
    keypair: z.ZodOptional<z.ZodObject<{
    privateKey: z.ZodOptional<z.ZodString>;
    certificateChain: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    }, {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    }>>;
    requireClientCerts: z.ZodOptional<z.ZodBoolean>;
    trustBrowserCas: z.ZodOptional<z.ZodBoolean>;
    trustedCertificates: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    minVersion: z.ZodOptional<z.ZodNativeEnum<{
    readonly GOOD_DEFAULT: 0;
    readonly SSL3: 1;
    readonly TLS1DOT0: 2;
    readonly TLS1DOT1: 3;
    readonly TLS1DOT2: 4;
    readonly TLS1DOT3: 5;
    }>>;
    cipherList: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    }, {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    }>>;
    }, "strip", z.ZodTypeAny, {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    }, {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    }>;
    }, "strip", z.ZodTypeAny, {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    }, {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    }>, z.ZodObject<{
    external: z.ZodType<ExternalServer_3, z.ZodTypeDef, ExternalServer_3>;
    }, "strip", z.ZodTypeAny, {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    }, {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    }>, z.ZodObject<{
    disk: z.ZodObject<{
    path: z.ZodString;
    writable: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
    path: string;
    writable?: boolean | undefined;
    }, {
    path: string;
    writable?: boolean | undefined;
    }>;
    }, "strip", z.ZodTypeAny, {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    }, {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    }>, z.ZodObject<{
    node: z.ZodType<(req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>, z.ZodTypeDef, (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>>;
    }, "strip", z.ZodTypeAny, {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    }, {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    }>, z.ZodType<(request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>, z.ZodTypeDef, (request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>>]>, "many">>;
    stripCfConnectingIp: z.ZodDefault<z.ZodBoolean>;
    containerEngine: z.ZodOptional<z.ZodUnion<[z.ZodObject<{
    localDocker: z.ZodObject<{
    socketPath: z.ZodString;
    }, "strip", z.ZodTypeAny, {
    socketPath: string;
    }, {
    socketPath: string;
    }>;
    }, "strip", z.ZodTypeAny, {
    localDocker: {
    socketPath: string;
    };
    }, {
    localDocker: {
    socketPath: string;
    };
    }>, z.ZodString]>>;
    unsafeBindings: z.ZodOptional<z.ZodArray<z.ZodObject<{
    name: z.ZodString;
    type: z.ZodString;
    plugin: z.ZodObject<{
    package: z.ZodString;
    name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
    name: string;
    package: string;
    }, {
    name: string;
    package: string;
    }>;
    options: z.ZodRecord<z.ZodString, z.ZodType<Json_2, z.ZodTypeDef, Json_2>>;
    }, "strip", z.ZodTypeAny, {
    type: string;
    name: string;
    options: Record<string, Json_2>;
    plugin: {
    name: string;
    package: string;
    };
    }, {
    type: string;
    name: string;
    options: Record<string, Json_2>;
    plugin: {
    name: string;
    package: string;
    };
    }>, "many">>;
    }, "strip", z.ZodTypeAny, {
    stripCfConnectingIp: boolean;
    name?: string | undefined;
    rootPath?: undefined;
    compatibilityDate?: string | undefined;
    compatibilityFlags?: string[] | undefined;
    unsafeInspectorProxy?: boolean | undefined;
    routes?: string[] | undefined;
    bindings?: Record<string, Json_2> | undefined;
    wasmBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    textBlobBindings?: Record<string, string> | undefined;
    dataBlobBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    serviceBindings?: Record<string, string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>)> | undefined;
    wrappedBindings?: Record<string, string | {
    scriptName: string;
    entrypoint?: string | undefined;
    bindings?: Record<string, Json_2> | undefined;
    }> | undefined;
    outboundService?: string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>) | undefined;
    fetchMock?: MockAgent<MockAgent> | undefined;
    unsafeEphemeralDurableObjects?: boolean | undefined;
    unsafeDirectSockets?: {
    host?: string | undefined;
    port?: number | undefined;
    serviceName?: string | undefined;
    entrypoint?: string | undefined;
    proxy?: boolean | undefined;
    }[] | undefined;
    unsafeEvalBinding?: string | undefined;
    unsafeUseModuleFallbackService?: boolean | undefined;
    hasAssetsAndIsVitest?: boolean | undefined;
    tails?: (string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>))[] | undefined;
    streamingTails?: (string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>))[] | undefined;
    containerEngine?: string | {
    localDocker: {
    socketPath: string;
    };
    } | undefined;
    unsafeBindings?: {
    type: string;
    name: string;
    options: Record<string, Json_2>;
    plugin: {
    name: string;
    package: string;
    };
    }[] | undefined;
    }, {
    name?: string | undefined;
    rootPath?: string | undefined;
    compatibilityDate?: string | undefined;
    compatibilityFlags?: string[] | undefined;
    unsafeInspectorProxy?: boolean | undefined;
    routes?: string[] | undefined;
    bindings?: Record<string, Json_2> | undefined;
    wasmBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    textBlobBindings?: Record<string, string> | undefined;
    dataBlobBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    serviceBindings?: Record<string, string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>)> | undefined;
    wrappedBindings?: Record<string, string | {
    scriptName: string;
    entrypoint?: string | undefined;
    bindings?: Record<string, Json_2> | undefined;
    }> | undefined;
    outboundService?: string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>) | undefined;
    fetchMock?: MockAgent<MockAgent> | undefined;
    unsafeEphemeralDurableObjects?: boolean | undefined;
    unsafeDirectSockets?: {
    host?: string | undefined;
    port?: number | undefined;
    serviceName?: string | undefined;
    entrypoint?: string | undefined;
    proxy?: boolean | undefined;
    }[] | undefined;
    unsafeEvalBinding?: string | undefined;
    unsafeUseModuleFallbackService?: boolean | undefined;
    hasAssetsAndIsVitest?: boolean | undefined;
    tails?: (string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>))[] | undefined;
    streamingTails?: (string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>))[] | undefined;
    stripCfConnectingIp?: boolean | undefined;
    containerEngine?: string | {
    localDocker: {
    socketPath: string;
    };
    } | undefined;
    unsafeBindings?: {
    type: string;
    name: string;
    options: Record<string, Json_2>;
    plugin: {
    name: string;
    package: string;
    };
    }[] | undefined;
    }>>, ({
    modules: {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    path: string;
    contents?: string | Uint8Array<ArrayBuffer> | undefined;
    }[];
    modulesRoot?: string | undefined;
    } & {
    stripCfConnectingIp: boolean;
    name?: string | undefined;
    rootPath?: undefined;
    compatibilityDate?: string | undefined;
    compatibilityFlags?: string[] | undefined;
    unsafeInspectorProxy?: boolean | undefined;
    routes?: string[] | undefined;
    bindings?: Record<string, Json_2> | undefined;
    wasmBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    textBlobBindings?: Record<string, string> | undefined;
    dataBlobBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    serviceBindings?: Record<string, string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>)> | undefined;
    wrappedBindings?: Record<string, string | {
    scriptName: string;
    entrypoint?: string | undefined;
    bindings?: Record<string, Json_2> | undefined;
    }> | undefined;
    outboundService?: string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>) | undefined;
    fetchMock?: MockAgent<MockAgent> | undefined;
    unsafeEphemeralDurableObjects?: boolean | undefined;
    unsafeDirectSockets?: {
    host?: string | undefined;
    port?: number | undefined;
    serviceName?: string | undefined;
    entrypoint?: string | undefined;
    proxy?: boolean | undefined;
    }[] | undefined;
    unsafeEvalBinding?: string | undefined;
    unsafeUseModuleFallbackService?: boolean | undefined;
    hasAssetsAndIsVitest?: boolean | undefined;
    tails?: (string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>))[] | undefined;
    streamingTails?: (string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>))[] | undefined;
    containerEngine?: string | {
    localDocker: {
    socketPath: string;
    };
    } | undefined;
    unsafeBindings?: {
    type: string;
    name: string;
    options: Record<string, Json_2>;
    plugin: {
    name: string;
    package: string;
    };
    }[] | undefined;
    }) | ({
    script: string;
    scriptPath?: string | undefined;
    modules?: boolean | undefined;
    modulesRules?: {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    include: string[];
    fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
    } & {
    stripCfConnectingIp: boolean;
    name?: string | undefined;
    rootPath?: undefined;
    compatibilityDate?: string | undefined;
    compatibilityFlags?: string[] | undefined;
    unsafeInspectorProxy?: boolean | undefined;
    routes?: string[] | undefined;
    bindings?: Record<string, Json_2> | undefined;
    wasmBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    textBlobBindings?: Record<string, string> | undefined;
    dataBlobBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    serviceBindings?: Record<string, string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>)> | undefined;
    wrappedBindings?: Record<string, string | {
    scriptName: string;
    entrypoint?: string | undefined;
    bindings?: Record<string, Json_2> | undefined;
    }> | undefined;
    outboundService?: string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>) | undefined;
    fetchMock?: MockAgent<MockAgent> | undefined;
    unsafeEphemeralDurableObjects?: boolean | undefined;
    unsafeDirectSockets?: {
    host?: string | undefined;
    port?: number | undefined;
    serviceName?: string | undefined;
    entrypoint?: string | undefined;
    proxy?: boolean | undefined;
    }[] | undefined;
    unsafeEvalBinding?: string | undefined;
    unsafeUseModuleFallbackService?: boolean | undefined;
    hasAssetsAndIsVitest?: boolean | undefined;
    tails?: (string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>))[] | undefined;
    streamingTails?: (string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>))[] | undefined;
    containerEngine?: string | {
    localDocker: {
    socketPath: string;
    };
    } | undefined;
    unsafeBindings?: {
    type: string;
    name: string;
    options: Record<string, Json_2>;
    plugin: {
    name: string;
    package: string;
    };
    }[] | undefined;
    }) | ({
    scriptPath: string;
    modules?: boolean | undefined;
    modulesRules?: {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    include: string[];
    fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
    } & {
    stripCfConnectingIp: boolean;
    name?: string | undefined;
    rootPath?: undefined;
    compatibilityDate?: string | undefined;
    compatibilityFlags?: string[] | undefined;
    unsafeInspectorProxy?: boolean | undefined;
    routes?: string[] | undefined;
    bindings?: Record<string, Json_2> | undefined;
    wasmBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    textBlobBindings?: Record<string, string> | undefined;
    dataBlobBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    serviceBindings?: Record<string, string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>)> | undefined;
    wrappedBindings?: Record<string, string | {
    scriptName: string;
    entrypoint?: string | undefined;
    bindings?: Record<string, Json_2> | undefined;
    }> | undefined;
    outboundService?: string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>) | undefined;
    fetchMock?: MockAgent<MockAgent> | undefined;
    unsafeEphemeralDurableObjects?: boolean | undefined;
    unsafeDirectSockets?: {
    host?: string | undefined;
    port?: number | undefined;
    serviceName?: string | undefined;
    entrypoint?: string | undefined;
    proxy?: boolean | undefined;
    }[] | undefined;
    unsafeEvalBinding?: string | undefined;
    unsafeUseModuleFallbackService?: boolean | undefined;
    hasAssetsAndIsVitest?: boolean | undefined;
    tails?: (string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>))[] | undefined;
    streamingTails?: (string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>))[] | undefined;
    containerEngine?: string | {
    localDocker: {
    socketPath: string;
    };
    } | undefined;
    unsafeBindings?: {
    type: string;
    name: string;
    options: Record<string, Json_2>;
    plugin: {
    name: string;
    package: string;
    };
    }[] | undefined;
    }), ({
    modules: {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    path: string;
    contents?: string | Uint8Array<ArrayBuffer> | undefined;
    }[];
    modulesRoot?: string | undefined;
    } | {
    script: string;
    scriptPath?: string | undefined;
    modules?: boolean | undefined;
    modulesRules?: {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    include: string[];
    fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
    } | {
    scriptPath: string;
    modules?: boolean | undefined;
    modulesRules?: {
    type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
    include: string[];
    fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
    }) & {
    name?: string | undefined;
    rootPath?: string | undefined;
    compatibilityDate?: string | undefined;
    compatibilityFlags?: string[] | undefined;
    unsafeInspectorProxy?: boolean | undefined;
    routes?: string[] | undefined;
    bindings?: Record<string, Json_2> | undefined;
    wasmBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    textBlobBindings?: Record<string, string> | undefined;
    dataBlobBindings?: Record<string, string | Uint8Array<ArrayBuffer>> | undefined;
    serviceBindings?: Record<string, string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>)> | undefined;
    wrappedBindings?: Record<string, string | {
    scriptName: string;
    entrypoint?: string | undefined;
    bindings?: Record<string, Json_2> | undefined;
    }> | undefined;
    outboundService?: string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>) | undefined;
    fetchMock?: MockAgent<MockAgent> | undefined;
    unsafeEphemeralDurableObjects?: boolean | undefined;
    unsafeDirectSockets?: {
    host?: string | undefined;
    port?: number | undefined;
    serviceName?: string | undefined;
    entrypoint?: string | undefined;
    proxy?: boolean | undefined;
    }[] | undefined;
    unsafeEvalBinding?: string | undefined;
    unsafeUseModuleFallbackService?: boolean | undefined;
    hasAssetsAndIsVitest?: boolean | undefined;
    tails?: (string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>))[] | undefined;
    streamingTails?: (string | kCurrentWorker_2 | {
    name: string | kCurrentWorker_2;
    entrypoint?: string | undefined;
    props?: Record<string, unknown> | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | {
    network: {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    tlsOptions?: {
    keypair?: {
    privateKey?: string | undefined;
    certificateChain?: string | undefined;
    } | undefined;
    requireClientCerts?: boolean | undefined;
    trustBrowserCas?: boolean | undefined;
    trustedCertificates?: string[] | undefined;
    minVersion?: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
    cipherList?: string | undefined;
    } | undefined;
    };
    } | {
    external: ExternalServer_3 & (ExternalServer_3 | undefined);
    } | {
    disk: {
    path: string;
    writable?: boolean | undefined;
    };
    } | {
    node: (req: IncomingMessage, res: ServerResponse, miniflare: Miniflare_3) => Awaitable_2<void>;
    } | ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>))[] | undefined;
    stripCfConnectingIp?: boolean | undefined;
    containerEngine?: string | {
    localDocker: {
    socketPath: string;
    };
    } | undefined;
    unsafeBindings?: {
    type: string;
    name: string;
    options: Record<string, Json_2>;
    plugin: {
    name: string;
    package: string;
    };
    }[] | undefined;
    }>, z.ZodEffects<z.ZodObject<{
    rootPath: z.ZodOptional<z.ZodEffects<z.ZodString, undefined, string>>;
    host: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
    https: z.ZodOptional<z.ZodBoolean>;
    httpsKey: z.ZodOptional<z.ZodString>;
    httpsKeyPath: z.ZodOptional<z.ZodString>;
    httpsCert: z.ZodOptional<z.ZodString>;
    httpsCertPath: z.ZodOptional<z.ZodString>;
    inspectorPort: z.ZodOptional<z.ZodNumber>;
    verbose: z.ZodOptional<z.ZodBoolean>;
    log: z.ZodOptional<z.ZodType<Log_2, z.ZodTypeDef, Log_2>>;
    handleRuntimeStdio: z.ZodOptional<z.ZodFunction<z.ZodTuple<[z.ZodType<Readable, z.ZodTypeDef, Readable>, z.ZodType<Readable, z.ZodTypeDef, Readable>], null>, z.ZodUnknown>>;
    handleStructuredLogs: z.ZodOptional<z.ZodFunction<z.ZodTuple<[z.ZodObject<{
    timestamp: z.ZodNumber;
    level: z.ZodString;
    message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
    message: string;
    timestamp: number;
    level: string;
    }, {
    message: string;
    timestamp: number;
    level: string;
    }>], null>, z.ZodVoid>>;
    upstream: z.ZodOptional<z.ZodString>;
    cf: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodRecord<z.ZodString, z.ZodAny>]>>;
    liveReload: z.ZodOptional<z.ZodBoolean>;
    unsafeDevRegistryPath: z.ZodOptional<z.ZodString>;
    unsafeDevRegistryDurableObjectProxy: z.ZodDefault<z.ZodBoolean>;
    unsafeHandleDevRegistryUpdate: z.ZodOptional<z.ZodFunction<z.ZodTuple<[z.ZodType<WorkerRegistry_2, z.ZodTypeDef, WorkerRegistry_2>], null>, z.ZodUnknown>>;
    unsafeProxySharedSecret: z.ZodOptional<z.ZodString>;
    unsafeModuleFallbackService: z.ZodOptional<z.ZodType<(request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>, z.ZodTypeDef, (request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>>>;
    unsafeStickyBlobs: z.ZodOptional<z.ZodBoolean>;
    unsafeTriggerHandlers: z.ZodOptional<z.ZodBoolean>;
    logRequests: z.ZodDefault<z.ZodBoolean>;
    defaultPersistRoot: z.ZodOptional<z.ZodString>;
    stripDisablePrettyError: z.ZodDefault<z.ZodBoolean>;
    structuredWorkerdLogs: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
    unsafeDevRegistryDurableObjectProxy: boolean;
    logRequests: boolean;
    stripDisablePrettyError: boolean;
    rootPath?: undefined;
    host?: string | undefined;
    port?: number | undefined;
    https?: boolean | undefined;
    httpsKey?: string | undefined;
    httpsKeyPath?: string | undefined;
    httpsCert?: string | undefined;
    httpsCertPath?: string | undefined;
    inspectorPort?: number | undefined;
    verbose?: boolean | undefined;
    log?: Log_2 | undefined;
    handleRuntimeStdio?: ((args_0: Readable, args_1: Readable) => unknown) | undefined;
    handleStructuredLogs?: ((args_0: {
    message: string;
    timestamp: number;
    level: string;
    }) => void) | undefined;
    upstream?: string | undefined;
    cf?: string | boolean | Record<string, any> | undefined;
    liveReload?: boolean | undefined;
    unsafeDevRegistryPath?: string | undefined;
    unsafeHandleDevRegistryUpdate?: ((args_0: WorkerRegistry_2) => unknown) | undefined;
    unsafeProxySharedSecret?: string | undefined;
    unsafeModuleFallbackService?: ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>) | undefined;
    unsafeStickyBlobs?: boolean | undefined;
    unsafeTriggerHandlers?: boolean | undefined;
    defaultPersistRoot?: string | undefined;
    structuredWorkerdLogs?: boolean | undefined;
    }, {
    rootPath?: string | undefined;
    host?: string | undefined;
    port?: number | undefined;
    https?: boolean | undefined;
    httpsKey?: string | undefined;
    httpsKeyPath?: string | undefined;
    httpsCert?: string | undefined;
    httpsCertPath?: string | undefined;
    inspectorPort?: number | undefined;
    verbose?: boolean | undefined;
    log?: Log_2 | undefined;
    handleRuntimeStdio?: ((args_0: Readable, args_1: Readable) => unknown) | undefined;
    handleStructuredLogs?: ((args_0: {
    message: string;
    timestamp: number;
    level: string;
    }) => void) | undefined;
    upstream?: string | undefined;
    cf?: string | boolean | Record<string, any> | undefined;
    liveReload?: boolean | undefined;
    unsafeDevRegistryPath?: string | undefined;
    unsafeDevRegistryDurableObjectProxy?: boolean | undefined;
    unsafeHandleDevRegistryUpdate?: ((args_0: WorkerRegistry_2) => unknown) | undefined;
    unsafeProxySharedSecret?: string | undefined;
    unsafeModuleFallbackService?: ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>) | undefined;
    unsafeStickyBlobs?: boolean | undefined;
    unsafeTriggerHandlers?: boolean | undefined;
    logRequests?: boolean | undefined;
    defaultPersistRoot?: string | undefined;
    stripDisablePrettyError?: boolean | undefined;
    structuredWorkerdLogs?: boolean | undefined;
    }>, {
    unsafeDevRegistryDurableObjectProxy: boolean;
    logRequests: boolean;
    stripDisablePrettyError: boolean;
    rootPath?: undefined;
    host?: string | undefined;
    port?: number | undefined;
    https?: boolean | undefined;
    httpsKey?: string | undefined;
    httpsKeyPath?: string | undefined;
    httpsCert?: string | undefined;
    httpsCertPath?: string | undefined;
    inspectorPort?: number | undefined;
    verbose?: boolean | undefined;
    log?: Log_2 | undefined;
    handleRuntimeStdio?: ((args_0: Readable, args_1: Readable) => unknown) | undefined;
    handleStructuredLogs?: ((args_0: {
    message: string;
    timestamp: number;
    level: string;
    }) => void) | undefined;
    upstream?: string | undefined;
    cf?: string | boolean | Record<string, any> | undefined;
    liveReload?: boolean | undefined;
    unsafeDevRegistryPath?: string | undefined;
    unsafeHandleDevRegistryUpdate?: ((args_0: WorkerRegistry_2) => unknown) | undefined;
    unsafeProxySharedSecret?: string | undefined;
    unsafeModuleFallbackService?: ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>) | undefined;
    unsafeStickyBlobs?: boolean | undefined;
    unsafeTriggerHandlers?: boolean | undefined;
    defaultPersistRoot?: string | undefined;
    structuredWorkerdLogs?: boolean | undefined;
    }, {
    rootPath?: string | undefined;
    host?: string | undefined;
    port?: number | undefined;
    https?: boolean | undefined;
    httpsKey?: string | undefined;
    httpsKeyPath?: string | undefined;
    httpsCert?: string | undefined;
    httpsCertPath?: string | undefined;
    inspectorPort?: number | undefined;
    verbose?: boolean | undefined;
    log?: Log_2 | undefined;
    handleRuntimeStdio?: ((args_0: Readable, args_1: Readable) => unknown) | undefined;
    handleStructuredLogs?: ((args_0: {
    message: string;
    timestamp: number;
    level: string;
    }) => void) | undefined;
    upstream?: string | undefined;
    cf?: string | boolean | Record<string, any> | undefined;
    liveReload?: boolean | undefined;
    unsafeDevRegistryPath?: string | undefined;
    unsafeDevRegistryDurableObjectProxy?: boolean | undefined;
    unsafeHandleDevRegistryUpdate?: ((args_0: WorkerRegistry_2) => unknown) | undefined;
    unsafeProxySharedSecret?: string | undefined;
    unsafeModuleFallbackService?: ((request: Request_6, miniflare: Miniflare_3) => Awaitable_2<Response_6>) | undefined;
    unsafeStickyBlobs?: boolean | undefined;
    unsafeTriggerHandlers?: boolean | undefined;
    logRequests?: boolean | undefined;
    defaultPersistRoot?: string | undefined;
    stripDisablePrettyError?: boolean | undefined;
    structuredWorkerdLogs?: boolean | undefined;
    }>>;
    cache: Plugin_2<z.ZodObject<{
    cache: z.ZodOptional<z.ZodBoolean>;
    cacheWarnUsage: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
    cache?: boolean | undefined;
    cacheWarnUsage?: boolean | undefined;
    }, {
    cache?: boolean | undefined;
    cacheWarnUsage?: boolean | undefined;
    }>, z.ZodObject<{
    cachePersist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
    }, "strip", z.ZodTypeAny, {
    cachePersist?: string | boolean | undefined;
    }, {
    cachePersist?: string | boolean | undefined;
    }>>;
    d1: Plugin_2<z.ZodObject<{
    d1Databases: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodString>, z.ZodRecord<z.ZodString, z.ZodObject<{
    id: z.ZodString;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>>, z.ZodArray<z.ZodString, "many">]>>;
    }, "strip", z.ZodTypeAny, {
    d1Databases?: string[] | Record<string, string> | Record<string, {
    id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    }, {
    d1Databases?: string[] | Record<string, string> | Record<string, {
    id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    }>, z.ZodObject<{
    d1Persist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
    }, "strip", z.ZodTypeAny, {
    d1Persist?: string | boolean | undefined;
    }, {
    d1Persist?: string | boolean | undefined;
    }>>;
    do: Plugin_2<z.ZodObject<{
    durableObjects: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodObject<{
    className: z.ZodString;
    scriptName: z.ZodOptional<z.ZodString>;
    useSQLite: z.ZodOptional<z.ZodBoolean>;
    unsafeUniqueKey: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<kUnsafeEphemeralUniqueKey_2>]>>;
    unsafePreventEviction: z.ZodOptional<z.ZodBoolean>;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    container: z.ZodOptional<z.ZodType<{
    imageName: string;
    }, z.ZodTypeDef, {
    imageName: string;
    }>>;
    }, "strip", z.ZodTypeAny, {
    className: string;
    scriptName?: string | undefined;
    useSQLite?: boolean | undefined;
    unsafeUniqueKey?: string | kUnsafeEphemeralUniqueKey_2 | undefined;
    unsafePreventEviction?: boolean | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    container?: {
    imageName: string;
    } | undefined;
    }, {
    className: string;
    scriptName?: string | undefined;
    useSQLite?: boolean | undefined;
    unsafeUniqueKey?: string | kUnsafeEphemeralUniqueKey_2 | undefined;
    unsafePreventEviction?: boolean | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    container?: {
    imageName: string;
    } | undefined;
    }>]>>>;
    additionalUnboundDurableObjects: z.ZodOptional<z.ZodArray<z.ZodObject<{
    className: z.ZodString;
    scriptName: z.ZodOptional<z.ZodString>;
    useSQLite: z.ZodOptional<z.ZodBoolean>;
    unsafeUniqueKey: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<kUnsafeEphemeralUniqueKey_2>]>>;
    unsafePreventEviction: z.ZodOptional<z.ZodBoolean>;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    container: z.ZodOptional<z.ZodType<{
    imageName: string;
    }, z.ZodTypeDef, {
    imageName: string;
    }>>;
    }, "strip", z.ZodTypeAny, {
    className: string;
    scriptName?: string | undefined;
    useSQLite?: boolean | undefined;
    unsafeUniqueKey?: string | kUnsafeEphemeralUniqueKey_2 | undefined;
    unsafePreventEviction?: boolean | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    container?: {
    imageName: string;
    } | undefined;
    }, {
    className: string;
    scriptName?: string | undefined;
    useSQLite?: boolean | undefined;
    unsafeUniqueKey?: string | kUnsafeEphemeralUniqueKey_2 | undefined;
    unsafePreventEviction?: boolean | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    container?: {
    imageName: string;
    } | undefined;
    }>, "many">>;
    }, "strip", z.ZodTypeAny, {
    durableObjects?: Record<string, string | {
    className: string;
    scriptName?: string | undefined;
    useSQLite?: boolean | undefined;
    unsafeUniqueKey?: string | kUnsafeEphemeralUniqueKey_2 | undefined;
    unsafePreventEviction?: boolean | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    container?: {
    imageName: string;
    } | undefined;
    }> | undefined;
    additionalUnboundDurableObjects?: {
    className: string;
    scriptName?: string | undefined;
    useSQLite?: boolean | undefined;
    unsafeUniqueKey?: string | kUnsafeEphemeralUniqueKey_2 | undefined;
    unsafePreventEviction?: boolean | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    container?: {
    imageName: string;
    } | undefined;
    }[] | undefined;
    }, {
    durableObjects?: Record<string, string | {
    className: string;
    scriptName?: string | undefined;
    useSQLite?: boolean | undefined;
    unsafeUniqueKey?: string | kUnsafeEphemeralUniqueKey_2 | undefined;
    unsafePreventEviction?: boolean | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    container?: {
    imageName: string;
    } | undefined;
    }> | undefined;
    additionalUnboundDurableObjects?: {
    className: string;
    scriptName?: string | undefined;
    useSQLite?: boolean | undefined;
    unsafeUniqueKey?: string | kUnsafeEphemeralUniqueKey_2 | undefined;
    unsafePreventEviction?: boolean | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    container?: {
    imageName: string;
    } | undefined;
    }[] | undefined;
    }>, z.ZodObject<{
    durableObjectsPersist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
    }, "strip", z.ZodTypeAny, {
    durableObjectsPersist?: string | boolean | undefined;
    }, {
    durableObjectsPersist?: string | boolean | undefined;
    }>>;
    kv: Plugin_2<z.ZodObject<{
    kvNamespaces: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodString>, z.ZodRecord<z.ZodString, z.ZodObject<{
    id: z.ZodString;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>>, z.ZodArray<z.ZodString, "many">]>>;
    sitePath: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    siteInclude: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    siteExclude: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
    kvNamespaces?: string[] | Record<string, string> | Record<string, {
    id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    sitePath?: string | undefined;
    siteInclude?: string[] | undefined;
    siteExclude?: string[] | undefined;
    }, {
    kvNamespaces?: string[] | Record<string, string> | Record<string, {
    id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    sitePath?: string | undefined;
    siteInclude?: string[] | undefined;
    siteExclude?: string[] | undefined;
    }>, z.ZodObject<{
    kvPersist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
    }, "strip", z.ZodTypeAny, {
    kvPersist?: string | boolean | undefined;
    }, {
    kvPersist?: string | boolean | undefined;
    }>>;
    queues: Plugin_2<z.ZodObject<{
    queueProducers: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodObject<{
    queueName: z.ZodString;
    deliveryDelay: z.ZodOptional<z.ZodNumber>;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    queueName: string;
    deliveryDelay?: number | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    queueName: string;
    deliveryDelay?: number | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>>, z.ZodArray<z.ZodString, "many">, z.ZodRecord<z.ZodString, z.ZodString>]>>;
    queueConsumers: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodEffects<z.ZodObject<{
    maxBatchSize: z.ZodOptional<z.ZodNumber>;
    maxBatchTimeout: z.ZodOptional<z.ZodNumber>;
    maxRetires: z.ZodOptional<z.ZodNumber>;
    maxRetries: z.ZodOptional<z.ZodNumber>;
    deadLetterQueue: z.ZodOptional<z.ZodString>;
    retryDelay: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
    }, {
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
    }>, Omit<{
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
    }, "maxRetires">, {
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
    }>>, z.ZodArray<z.ZodString, "many">]>>;
    }, "strip", z.ZodTypeAny, {
    queueProducers?: string[] | Record<string, string> | Record<string, {
    queueName: string;
    deliveryDelay?: number | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    queueConsumers?: string[] | Record<string, Omit<{
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
    }, "maxRetires">> | undefined;
    }, {
    queueProducers?: string[] | Record<string, string> | Record<string, {
    queueName: string;
    deliveryDelay?: number | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    queueConsumers?: string[] | Record<string, {
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
    }> | undefined;
    }>>;
    r2: Plugin_2<z.ZodObject<{
    r2Buckets: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodString>, z.ZodRecord<z.ZodString, z.ZodObject<{
    id: z.ZodString;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>>, z.ZodArray<z.ZodString, "many">]>>;
    }, "strip", z.ZodTypeAny, {
    r2Buckets?: string[] | Record<string, string> | Record<string, {
    id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    }, {
    r2Buckets?: string[] | Record<string, string> | Record<string, {
    id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    }>, z.ZodObject<{
    r2Persist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
    }, "strip", z.ZodTypeAny, {
    r2Persist?: string | boolean | undefined;
    }, {
    r2Persist?: string | boolean | undefined;
    }>>;
    hyperdrive: Plugin_2<z.ZodObject<{
    hyperdrives: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<URL_2, z.ZodTypeDef, URL_2>]>, URL_2, string | URL_2>>>;
    }, "strip", z.ZodTypeAny, {
    hyperdrives?: Record<string, URL_2> | undefined;
    }, {
    hyperdrives?: Record<string, string | URL_2> | undefined;
    }>>;
    ratelimit: Plugin_2<z.ZodObject<{
    ratelimits: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
    simple: z.ZodObject<{
    limit: z.ZodNumber;
    period: z.ZodOptional<z.ZodNativeEnum<PeriodType_2>>;
    }, "strip", z.ZodTypeAny, {
    limit: number;
    period?: PeriodType_2 | undefined;
    }, {
    limit: number;
    period?: PeriodType_2 | undefined;
    }>;
    }, "strip", z.ZodTypeAny, {
    simple: {
    limit: number;
    period?: PeriodType_2 | undefined;
    };
    }, {
    simple: {
    limit: number;
    period?: PeriodType_2 | undefined;
    };
    }>>>;
    }, "strip", z.ZodTypeAny, {
    ratelimits?: Record<string, {
    simple: {
    limit: number;
    period?: PeriodType_2 | undefined;
    };
    }> | undefined;
    }, {
    ratelimits?: Record<string, {
    simple: {
    limit: number;
    period?: PeriodType_2 | undefined;
    };
    }> | undefined;
    }>>;
    assets: Plugin_2<z.ZodObject<{
    assets: z.ZodOptional<z.ZodObject<{
    workerName: z.ZodOptional<z.ZodString>;
    directory: z.ZodEffects<z.ZodString, string, string>;
    binding: z.ZodOptional<z.ZodString>;
    routerConfig: z.ZodOptional<z.ZodObject<{
    account_id: z.ZodOptional<z.ZodNumber>;
    script_id: z.ZodOptional<z.ZodNumber>;
    debug: z.ZodOptional<z.ZodBoolean>;
    invoke_user_worker_ahead_of_assets: z.ZodOptional<z.ZodBoolean>;
    static_routing: z.ZodOptional<z.ZodObject<{
    user_worker: z.ZodArray<z.ZodString, "many">;
    asset_worker: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
    user_worker: string[];
    asset_worker?: string[] | undefined;
    }, {
    user_worker: string[];
    asset_worker?: string[] | undefined;
    }>>;
    has_user_worker: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
    account_id?: number | undefined;
    script_id?: number | undefined;
    debug?: boolean | undefined;
    invoke_user_worker_ahead_of_assets?: boolean | undefined;
    static_routing?: {
    user_worker: string[];
    asset_worker?: string[] | undefined;
    } | undefined;
    has_user_worker?: boolean | undefined;
    }, {
    account_id?: number | undefined;
    script_id?: number | undefined;
    debug?: boolean | undefined;
    invoke_user_worker_ahead_of_assets?: boolean | undefined;
    static_routing?: {
    user_worker: string[];
    asset_worker?: string[] | undefined;
    } | undefined;
    has_user_worker?: boolean | undefined;
    }>>;
    assetConfig: z.ZodOptional<z.ZodObject<Omit<{
    account_id: z.ZodOptional<z.ZodNumber>;
    script_id: z.ZodOptional<z.ZodNumber>;
    debug: z.ZodOptional<z.ZodBoolean>;
    compatibility_date: z.ZodOptional<z.ZodString>;
    compatibility_flags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    html_handling: z.ZodOptional<z.ZodEnum<["auto-trailing-slash", "force-trailing-slash", "drop-trailing-slash", "none"]>>;
    not_found_handling: z.ZodOptional<z.ZodEnum<["single-page-application", "404-page", "none"]>>;
    redirects: z.ZodOptional<z.ZodObject<{
    version: z.ZodLiteral<1>;
    staticRules: z.ZodRecord<z.ZodString, z.ZodObject<{
    status: z.ZodNumber;
    to: z.ZodString;
    lineNumber: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
    status: number;
    to: string;
    lineNumber: number;
    }, {
    status: number;
    to: string;
    lineNumber: number;
    }>>;
    rules: z.ZodRecord<z.ZodString, z.ZodObject<{
    status: z.ZodNumber;
    to: z.ZodString;
    }, "strip", z.ZodTypeAny, {
    status: number;
    to: string;
    }, {
    status: number;
    to: string;
    }>>;
    }, "strip", z.ZodTypeAny, {
    version: 1;
    staticRules: Record<string, {
    status: number;
    to: string;
    lineNumber: number;
    }>;
    rules: Record<string, {
    status: number;
    to: string;
    }>;
    }, {
    version: 1;
    staticRules: Record<string, {
    status: number;
    to: string;
    lineNumber: number;
    }>;
    rules: Record<string, {
    status: number;
    to: string;
    }>;
    }>>;
    headers: z.ZodOptional<z.ZodObject<{
    version: z.ZodLiteral<2>;
    rules: z.ZodRecord<z.ZodString, z.ZodObject<{
    set: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
    set?: Record<string, string> | undefined;
    unset?: string[] | undefined;
    }, {
    set?: Record<string, string> | undefined;
    unset?: string[] | undefined;
    }>>;
    }, "strip", z.ZodTypeAny, {
    version: 2;
    rules: Record<string, {
    set?: Record<string, string> | undefined;
    unset?: string[] | undefined;
    }>;
    }, {
    version: 2;
    rules: Record<string, {
    set?: Record<string, string> | undefined;
    unset?: string[] | undefined;
    }>;
    }>>;
    has_static_routing: z.ZodOptional<z.ZodBoolean>;
    }, "compatibility_date" | "compatibility_flags">, "strip", z.ZodTypeAny, {
    debug?: boolean | undefined;
    headers?: {
    version: 2;
    rules: Record<string, {
    set?: Record<string, string> | undefined;
    unset?: string[] | undefined;
    }>;
    } | undefined;
    account_id?: number | undefined;
    script_id?: number | undefined;
    html_handling?: "none" | "auto-trailing-slash" | "force-trailing-slash" | "drop-trailing-slash" | undefined;
    not_found_handling?: "none" | "single-page-application" | "404-page" | undefined;
    redirects?: {
    version: 1;
    staticRules: Record<string, {
    status: number;
    to: string;
    lineNumber: number;
    }>;
    rules: Record<string, {
    status: number;
    to: string;
    }>;
    } | undefined;
    has_static_routing?: boolean | undefined;
    }, {
    debug?: boolean | undefined;
    headers?: {
    version: 2;
    rules: Record<string, {
    set?: Record<string, string> | undefined;
    unset?: string[] | undefined;
    }>;
    } | undefined;
    account_id?: number | undefined;
    script_id?: number | undefined;
    html_handling?: "none" | "auto-trailing-slash" | "force-trailing-slash" | "drop-trailing-slash" | undefined;
    not_found_handling?: "none" | "single-page-application" | "404-page" | undefined;
    redirects?: {
    version: 1;
    staticRules: Record<string, {
    status: number;
    to: string;
    lineNumber: number;
    }>;
    rules: Record<string, {
    status: number;
    to: string;
    }>;
    } | undefined;
    has_static_routing?: boolean | undefined;
    }>>;
    }, "strip", z.ZodTypeAny, {
    directory: string;
    workerName?: string | undefined;
    binding?: string | undefined;
    routerConfig?: {
    account_id?: number | undefined;
    script_id?: number | undefined;
    debug?: boolean | undefined;
    invoke_user_worker_ahead_of_assets?: boolean | undefined;
    static_routing?: {
    user_worker: string[];
    asset_worker?: string[] | undefined;
    } | undefined;
    has_user_worker?: boolean | undefined;
    } | undefined;
    assetConfig?: {
    debug?: boolean | undefined;
    headers?: {
    version: 2;
    rules: Record<string, {
    set?: Record<string, string> | undefined;
    unset?: string[] | undefined;
    }>;
    } | undefined;
    account_id?: number | undefined;
    script_id?: number | undefined;
    html_handling?: "none" | "auto-trailing-slash" | "force-trailing-slash" | "drop-trailing-slash" | undefined;
    not_found_handling?: "none" | "single-page-application" | "404-page" | undefined;
    redirects?: {
    version: 1;
    staticRules: Record<string, {
    status: number;
    to: string;
    lineNumber: number;
    }>;
    rules: Record<string, {
    status: number;
    to: string;
    }>;
    } | undefined;
    has_static_routing?: boolean | undefined;
    } | undefined;
    }, {
    directory: string;
    workerName?: string | undefined;
    binding?: string | undefined;
    routerConfig?: {
    account_id?: number | undefined;
    script_id?: number | undefined;
    debug?: boolean | undefined;
    invoke_user_worker_ahead_of_assets?: boolean | undefined;
    static_routing?: {
    user_worker: string[];
    asset_worker?: string[] | undefined;
    } | undefined;
    has_user_worker?: boolean | undefined;
    } | undefined;
    assetConfig?: {
    debug?: boolean | undefined;
    headers?: {
    version: 2;
    rules: Record<string, {
    set?: Record<string, string> | undefined;
    unset?: string[] | undefined;
    }>;
    } | undefined;
    account_id?: number | undefined;
    script_id?: number | undefined;
    html_handling?: "none" | "auto-trailing-slash" | "force-trailing-slash" | "drop-trailing-slash" | undefined;
    not_found_handling?: "none" | "single-page-application" | "404-page" | undefined;
    redirects?: {
    version: 1;
    staticRules: Record<string, {
    status: number;
    to: string;
    lineNumber: number;
    }>;
    rules: Record<string, {
    status: number;
    to: string;
    }>;
    } | undefined;
    has_static_routing?: boolean | undefined;
    } | undefined;
    }>>;
    compatibilityDate: z.ZodOptional<z.ZodString>;
    compatibilityFlags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
    assets?: {
    directory: string;
    workerName?: string | undefined;
    binding?: string | undefined;
    routerConfig?: {
    account_id?: number | undefined;
    script_id?: number | undefined;
    debug?: boolean | undefined;
    invoke_user_worker_ahead_of_assets?: boolean | undefined;
    static_routing?: {
    user_worker: string[];
    asset_worker?: string[] | undefined;
    } | undefined;
    has_user_worker?: boolean | undefined;
    } | undefined;
    assetConfig?: {
    debug?: boolean | undefined;
    headers?: {
    version: 2;
    rules: Record<string, {
    set?: Record<string, string> | undefined;
    unset?: string[] | undefined;
    }>;
    } | undefined;
    account_id?: number | undefined;
    script_id?: number | undefined;
    html_handling?: "none" | "auto-trailing-slash" | "force-trailing-slash" | "drop-trailing-slash" | undefined;
    not_found_handling?: "none" | "single-page-application" | "404-page" | undefined;
    redirects?: {
    version: 1;
    staticRules: Record<string, {
    status: number;
    to: string;
    lineNumber: number;
    }>;
    rules: Record<string, {
    status: number;
    to: string;
    }>;
    } | undefined;
    has_static_routing?: boolean | undefined;
    } | undefined;
    } | undefined;
    compatibilityDate?: string | undefined;
    compatibilityFlags?: string[] | undefined;
    }, {
    assets?: {
    directory: string;
    workerName?: string | undefined;
    binding?: string | undefined;
    routerConfig?: {
    account_id?: number | undefined;
    script_id?: number | undefined;
    debug?: boolean | undefined;
    invoke_user_worker_ahead_of_assets?: boolean | undefined;
    static_routing?: {
    user_worker: string[];
    asset_worker?: string[] | undefined;
    } | undefined;
    has_user_worker?: boolean | undefined;
    } | undefined;
    assetConfig?: {
    debug?: boolean | undefined;
    headers?: {
    version: 2;
    rules: Record<string, {
    set?: Record<string, string> | undefined;
    unset?: string[] | undefined;
    }>;
    } | undefined;
    account_id?: number | undefined;
    script_id?: number | undefined;
    html_handling?: "none" | "auto-trailing-slash" | "force-trailing-slash" | "drop-trailing-slash" | undefined;
    not_found_handling?: "none" | "single-page-application" | "404-page" | undefined;
    redirects?: {
    version: 1;
    staticRules: Record<string, {
    status: number;
    to: string;
    lineNumber: number;
    }>;
    rules: Record<string, {
    status: number;
    to: string;
    }>;
    } | undefined;
    has_static_routing?: boolean | undefined;
    } | undefined;
    } | undefined;
    compatibilityDate?: string | undefined;
    compatibilityFlags?: string[] | undefined;
    }>>;
    workflows: Plugin_2<z.ZodObject<{
    workflows: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
    name: z.ZodString;
    className: z.ZodString;
    scriptName: z.ZodOptional<z.ZodString>;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    name: string;
    className: string;
    scriptName?: string | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    name: string;
    className: string;
    scriptName?: string | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>>>;
    }, "strip", z.ZodTypeAny, {
    workflows?: Record<string, {
    name: string;
    className: string;
    scriptName?: string | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    }, {
    workflows?: Record<string, {
    name: string;
    className: string;
    scriptName?: string | undefined;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    }>, z.ZodObject<{
    workflowsPersist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
    }, "strip", z.ZodTypeAny, {
    workflowsPersist?: string | boolean | undefined;
    }, {
    workflowsPersist?: string | boolean | undefined;
    }>>;
    pipelines: Plugin_2<z.ZodObject<{
    pipelines: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodString>, z.ZodArray<z.ZodString, "many">, z.ZodRecord<z.ZodString, z.ZodObject<{
    pipeline: z.ZodString;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    pipeline: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    pipeline: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>>]>>;
    }, "strip", z.ZodTypeAny, {
    pipelines?: string[] | Record<string, string> | Record<string, {
    pipeline: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    }, {
    pipelines?: string[] | Record<string, string> | Record<string, {
    pipeline: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    }>>;
    "secrets-store": Plugin_2<z.ZodObject<{
    secretsStoreSecrets: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
    store_id: z.ZodString;
    secret_name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
    store_id: string;
    secret_name: string;
    }, {
    store_id: string;
    secret_name: string;
    }>>>;
    }, "strip", z.ZodTypeAny, {
    secretsStoreSecrets?: Record<string, {
    store_id: string;
    secret_name: string;
    }> | undefined;
    }, {
    secretsStoreSecrets?: Record<string, {
    store_id: string;
    secret_name: string;
    }> | undefined;
    }>, z.ZodObject<{
    secretsStorePersist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
    }, "strip", z.ZodTypeAny, {
    secretsStorePersist?: string | boolean | undefined;
    }, {
    secretsStorePersist?: string | boolean | undefined;
    }>>;
    email: Plugin_2<z.ZodObject<{
    email: z.ZodOptional<z.ZodObject<{
    send_email: z.ZodOptional<z.ZodArray<z.ZodIntersection<z.ZodObject<{
    name: z.ZodString;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    allowed_sender_addresses: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
    name: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    allowed_sender_addresses?: string[] | undefined;
    }, {
    name: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    allowed_sender_addresses?: string[] | undefined;
    }>, z.ZodUnion<[z.ZodObject<{
    destination_address: z.ZodOptional<z.ZodString>;
    allowed_destination_addresses: z.ZodOptional<z.ZodNever>;
    }, "strip", z.ZodTypeAny, {
    destination_address?: string | undefined;
    allowed_destination_addresses?: undefined;
    }, {
    destination_address?: string | undefined;
    allowed_destination_addresses?: undefined;
    }>, z.ZodObject<{
    allowed_destination_addresses: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    destination_address: z.ZodOptional<z.ZodNever>;
    }, "strip", z.ZodTypeAny, {
    allowed_destination_addresses?: string[] | undefined;
    destination_address?: undefined;
    }, {
    allowed_destination_addresses?: string[] | undefined;
    destination_address?: undefined;
    }>]>>, "many">>;
    }, "strip", z.ZodTypeAny, {
    send_email?: ({
    name: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    allowed_sender_addresses?: string[] | undefined;
    } & ({
    destination_address?: string | undefined;
    allowed_destination_addresses?: undefined;
    } | {
    allowed_destination_addresses?: string[] | undefined;
    destination_address?: undefined;
    }))[] | undefined;
    }, {
    send_email?: ({
    name: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    allowed_sender_addresses?: string[] | undefined;
    } & ({
    destination_address?: string | undefined;
    allowed_destination_addresses?: undefined;
    } | {
    allowed_destination_addresses?: string[] | undefined;
    destination_address?: undefined;
    }))[] | undefined;
    }>>;
    }, "strip", z.ZodTypeAny, {
    email?: {
    send_email?: ({
    name: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    allowed_sender_addresses?: string[] | undefined;
    } & ({
    destination_address?: string | undefined;
    allowed_destination_addresses?: undefined;
    } | {
    allowed_destination_addresses?: string[] | undefined;
    destination_address?: undefined;
    }))[] | undefined;
    } | undefined;
    }, {
    email?: {
    send_email?: ({
    name: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    allowed_sender_addresses?: string[] | undefined;
    } & ({
    destination_address?: string | undefined;
    allowed_destination_addresses?: undefined;
    } | {
    allowed_destination_addresses?: string[] | undefined;
    destination_address?: undefined;
    }))[] | undefined;
    } | undefined;
    }>>;
    "analytics-engine": Plugin_2<z.ZodObject<{
    analyticsEngineDatasets: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
    dataset: z.ZodString;
    }, "strip", z.ZodTypeAny, {
    dataset: string;
    }, {
    dataset: string;
    }>>>;
    }, "strip", z.ZodTypeAny, {
    analyticsEngineDatasets?: Record<string, {
    dataset: string;
    }> | undefined;
    }, {
    analyticsEngineDatasets?: Record<string, {
    dataset: string;
    }> | undefined;
    }>, z.ZodObject<{
    analyticsEngineDatasetsPersist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
    }, "strip", z.ZodTypeAny, {
    analyticsEngineDatasetsPersist?: string | boolean | undefined;
    }, {
    analyticsEngineDatasetsPersist?: string | boolean | undefined;
    }>>;
    ai: Plugin_2<z.ZodObject<{
    ai: z.ZodOptional<z.ZodObject<{
    binding: z.ZodString;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    binding: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    binding: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>>;
    }, "strip", z.ZodTypeAny, {
    ai?: {
    binding: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | undefined;
    }, {
    ai?: {
    binding: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | undefined;
    }>>;
    "browser-rendering": Plugin_2<z.ZodObject<{
    browserRendering: z.ZodOptional<z.ZodObject<{
    binding: z.ZodString;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    binding: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    binding: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>>;
    }, "strip", z.ZodTypeAny, {
    browserRendering?: {
    binding: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | undefined;
    }, {
    browserRendering?: {
    binding: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | undefined;
    }>>;
    "dispatch-namespace": Plugin_2<z.ZodObject<{
    dispatchNamespaces: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
    namespace: z.ZodString;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    namespace: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    namespace: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>>>;
    }, "strip", z.ZodTypeAny, {
    dispatchNamespaces?: Record<string, {
    namespace: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    }, {
    dispatchNamespaces?: Record<string, {
    namespace: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    }>>;
    images: Plugin_2<z.ZodObject<{
    images: z.ZodOptional<z.ZodObject<{
    binding: z.ZodString;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    binding: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    binding: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>>;
    }, "strip", z.ZodTypeAny, {
    images?: {
    binding: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | undefined;
    }, {
    images?: {
    binding: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | undefined;
    }>>;
    vectorize: Plugin_2<z.ZodObject<{
    vectorize: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
    index_name: z.ZodString;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    index_name: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    index_name: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>>>;
    }, "strip", z.ZodTypeAny, {
    vectorize?: Record<string, {
    index_name: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    }, {
    vectorize?: Record<string, {
    index_name: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    }>>;
    "vpc-services": Plugin_2<z.ZodObject<{
    vpcServices: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
    service_id: z.ZodString;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    service_id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    service_id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>>>;
    }, "strip", z.ZodTypeAny, {
    vpcServices?: Record<string, {
    service_id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    }, {
    vpcServices?: Record<string, {
    service_id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    }>>;
    mtls: Plugin_2<z.ZodObject<{
    mtlsCertificates: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
    certificate_id: z.ZodString;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    certificate_id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    certificate_id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>>>;
    }, "strip", z.ZodTypeAny, {
    mtlsCertificates?: Record<string, {
    certificate_id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    }, {
    mtlsCertificates?: Record<string, {
    certificate_id: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }> | undefined;
    }>>;
    "hello-world": Plugin_2<z.ZodObject<{
    helloWorld: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
    enable_timer: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
    enable_timer?: boolean | undefined;
    }, {
    enable_timer?: boolean | undefined;
    }>>>;
    }, "strip", z.ZodTypeAny, {
    helloWorld?: Record<string, {
    enable_timer?: boolean | undefined;
    }> | undefined;
    }, {
    helloWorld?: Record<string, {
    enable_timer?: boolean | undefined;
    }> | undefined;
    }>, z.ZodObject<{
    helloWorldPersist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
    }, "strip", z.ZodTypeAny, {
    helloWorldPersist?: string | boolean | undefined;
    }, {
    helloWorldPersist?: string | boolean | undefined;
    }>>;
    "worker-loader": Plugin_2<z.ZodObject<{
    workerLoaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>>>;
    }, "strip", z.ZodTypeAny, {
    workerLoaders?: Record<string, {}> | undefined;
    }, {
    workerLoaders?: Record<string, {}> | undefined;
    }>>;
    media: Plugin_2<z.ZodObject<{
    media: z.ZodOptional<z.ZodObject<{
    binding: z.ZodString;
    remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString_3, z.ZodTypeDef, RemoteProxyConnectionString_3>>;
    }, "strip", z.ZodTypeAny, {
    binding: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }, {
    binding: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    }>>;
    }, "strip", z.ZodTypeAny, {
    media?: {
    binding: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | undefined;
    }, {
    media?: {
    binding: string;
    remoteProxyConnectionString?: RemoteProxyConnectionString_3 | undefined;
    } | undefined;
    }>>;
};

export declare type Plugins = typeof PLUGINS;

export declare interface PluginServicesOptions<Options extends z.ZodType, SharedOptions extends z.ZodType | undefined> {
    log: Log;
    options: z.infer<Options>;
    sharedOptions: OptionalZodTypeOf<SharedOptions>;
    workerBindings: Worker_Binding[];
    workerIndex: number;
    additionalModules: Worker_Module[];
    tmpPath: string;
    defaultPersistRoot: string | undefined;
    workerNames: string[];
    loopbackPort: number;
    unsafeStickyBlobs: boolean;
    wrappedBindingNames: WrappedBindingNames;
    durableObjectClassNames: DurableObjectClassNames;
    unsafeEphemeralDurableObjects: boolean;
    queueProducers: QueueProducers;
    queueConsumers: QueueConsumers;
    hyperdriveProxyController: HyperdriveProxyController;
}

export declare const POSTGRES_SSL_REQUEST_PACKET: Buffer<ArrayBuffer>;

export declare function prefixError(prefix: string, e: any): Error;

export declare function prefixStream(prefix: Uint8Array, stream: ReadableStream_3<Uint8Array>): ReadableStream_3<Uint8Array>;

/**
 * Processes a stack trace by applying a custom frame transformer.
 * The transformer receives each frame line and its location (file:line:column);
 * if it returns null, that frame is dropped; otherwise its return value replaces the line.
 */
export declare function processStackTrace(stack: string, transformFrame: (line: string, location: string) => string | null): string;

export declare const ProxyAddresses: {
    readonly GLOBAL: 0;
    readonly ENV: 1;
    readonly USER_START: 2;
};

export declare class ProxyClient {
    #private;
    constructor(runtimeEntryURL: URL, dispatchFetch: DispatchFetch);
    get global(): ServiceWorkerGlobalScope;
    get env(): Record<string, unknown>;
    poisonProxies(): void;
    setRuntimeEntryURL(runtimeEntryURL: URL): void;
    dispose(): Promise<void>;
}

export declare class ProxyNodeBinding {
    proxyOverrideHandler?: ProxyHandler<any> | undefined;
    constructor(proxyOverrideHandler?: ProxyHandler<any> | undefined);
}

export declare const ProxyOps: {
    readonly GET: "GET";
    readonly GET_OWN_DESCRIPTOR: "GET_OWN_DESCRIPTOR";
    readonly GET_OWN_KEYS: "GET_OWN_KEYS";
    readonly CALL: "CALL";
    readonly FREE: "FREE";
};

export declare const QueueBindings: {
    readonly SERVICE_WORKER_PREFIX: "MINIFLARE_WORKER_";
    readonly MAYBE_JSON_QUEUE_PRODUCERS: "MINIFLARE_QUEUE_PRODUCERS";
    readonly MAYBE_JSON_QUEUE_CONSUMERS: "MINIFLARE_QUEUE_CONSUMERS";
};

export declare type QueueConsumer = z.infer<typeof QueueConsumerSchema>;

export declare const QueueConsumerOptionsSchema: z.ZodEffects<z.ZodObject<{
    maxBatchSize: z.ZodOptional<z.ZodNumber>;
    maxBatchTimeout: z.ZodOptional<z.ZodNumber>;
    maxRetires: z.ZodOptional<z.ZodNumber>;
    maxRetries: z.ZodOptional<z.ZodNumber>;
    deadLetterQueue: z.ZodOptional<z.ZodString>;
    retryDelay: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
}, {
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
}>, Omit<{
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
}, "maxRetires">, {
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
}>;

export declare type QueueConsumers = Map<string, z.infer<typeof QueueConsumerSchema>>;

export declare const QueueConsumerSchema: z.ZodIntersection<z.ZodEffects<z.ZodObject<{
    maxBatchSize: z.ZodOptional<z.ZodNumber>;
    maxBatchTimeout: z.ZodOptional<z.ZodNumber>;
    maxRetires: z.ZodOptional<z.ZodNumber>;
    maxRetries: z.ZodOptional<z.ZodNumber>;
    deadLetterQueue: z.ZodOptional<z.ZodString>;
    retryDelay: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
}, {
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
}>, Omit<{
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
}, "maxRetires">, {
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
}>, z.ZodObject<{
    workerName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    workerName: string;
}, {
    workerName: string;
}>>;

export declare const QueueConsumersSchema: z.ZodRecord<z.ZodString, z.ZodIntersection<z.ZodEffects<z.ZodObject<{
    maxBatchSize: z.ZodOptional<z.ZodNumber>;
    maxBatchTimeout: z.ZodOptional<z.ZodNumber>;
    maxRetires: z.ZodOptional<z.ZodNumber>;
    maxRetries: z.ZodOptional<z.ZodNumber>;
    deadLetterQueue: z.ZodOptional<z.ZodString>;
    retryDelay: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
}, {
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
}>, Omit<{
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
}, "maxRetires">, {
    maxBatchSize?: number | undefined;
    maxBatchTimeout?: number | undefined;
    maxRetires?: number | undefined;
    maxRetries?: number | undefined;
    deadLetterQueue?: string | undefined;
    retryDelay?: number | undefined;
}>, z.ZodObject<{
    workerName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    workerName: string;
}, {
    workerName: string;
}>>>;

export declare type QueueContentType = z.infer<typeof QueueContentTypeSchema>;

export declare const QueueContentTypeSchema: z.ZodDefault<z.ZodEnum<["text", "json", "bytes", "v8"]>>;

export declare type QueueIncomingMessage = z.infer<typeof QueueIncomingMessageSchema>;

export declare const QueueIncomingMessageSchema: z.ZodObject<{
    contentType: z.ZodDefault<z.ZodEnum<["text", "json", "bytes", "v8"]>>;
    delaySecs: z.ZodOptional<z.ZodNumber>;
    body: z.ZodEffects<z.ZodString, Buffer<ArrayBuffer>, string>;
    id: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    body: Buffer<ArrayBuffer>;
    contentType: "text" | "json" | "bytes" | "v8";
    delaySecs?: number | undefined;
    id?: string | undefined;
    timestamp?: number | undefined;
}, {
    body: string;
    contentType?: "text" | "json" | "bytes" | "v8" | undefined;
    delaySecs?: number | undefined;
    id?: string | undefined;
    timestamp?: number | undefined;
}>;

export declare type QueueMessageDelay = z.infer<typeof QueueMessageDelaySchema>;

export declare const QueueMessageDelaySchema: z.ZodOptional<z.ZodNumber>;

export declare type QueueOutgoingMessage = z.input<typeof QueueIncomingMessageSchema>;

export declare type QueueProducer = z.infer<typeof QueueProducerSchema>;

export declare const QueueProducerOptionsSchema: z.ZodObject<{
    queueName: z.ZodString;
    deliveryDelay: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    queueName: string;
    deliveryDelay?: number | undefined;
}, {
    queueName: string;
    deliveryDelay?: number | undefined;
}>;

export declare type QueueProducers = Map<string, z.infer<typeof QueueProducerSchema>>;

export declare const QueueProducerSchema: z.ZodIntersection<z.ZodObject<{
    queueName: z.ZodString;
    deliveryDelay: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    queueName: string;
    deliveryDelay?: number | undefined;
}, {
    queueName: string;
    deliveryDelay?: number | undefined;
}>, z.ZodObject<{
    workerName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    workerName: string;
}, {
    workerName: string;
}>>;

export declare const QueueProducersSchema: z.ZodRecord<z.ZodString, z.ZodIntersection<z.ZodObject<{
    queueName: z.ZodString;
    deliveryDelay: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    queueName: string;
    deliveryDelay?: number | undefined;
}, {
    queueName: string;
    deliveryDelay?: number | undefined;
}>, z.ZodObject<{
    workerName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    workerName: string;
}, {
    workerName: string;
}>>>;

export declare const QUEUES_PLUGIN: Plugin<typeof QueuesOptionsSchema>;

export declare const QUEUES_PLUGIN_NAME = "queues";

export declare const QueuesBatchRequestSchema: z.ZodObject<{
    messages: z.ZodArray<z.ZodObject<{
        contentType: z.ZodDefault<z.ZodEnum<["text", "json", "bytes", "v8"]>>;
        delaySecs: z.ZodOptional<z.ZodNumber>;
        body: z.ZodEffects<z.ZodString, Buffer<ArrayBuffer>, string>;
        id: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        body: Buffer<ArrayBuffer>;
        contentType: "text" | "json" | "bytes" | "v8";
        delaySecs?: number | undefined;
        id?: string | undefined;
        timestamp?: number | undefined;
    }, {
        body: string;
        contentType?: "text" | "json" | "bytes" | "v8" | undefined;
        delaySecs?: number | undefined;
        id?: string | undefined;
        timestamp?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    messages: {
        body: Buffer<ArrayBuffer>;
        contentType: "text" | "json" | "bytes" | "v8";
        delaySecs?: number | undefined;
        id?: string | undefined;
        timestamp?: number | undefined;
    }[];
}, {
    messages: {
        body: string;
        contentType?: "text" | "json" | "bytes" | "v8" | undefined;
        delaySecs?: number | undefined;
        id?: string | undefined;
        timestamp?: number | undefined;
    }[];
}>;

export declare class QueuesError extends MiniflareError<QueuesErrorCode> {
}

export declare type QueuesErrorCode = "ERR_MULTIPLE_CONSUMERS" | "ERR_DEAD_LETTER_QUEUE_CYCLE";

export declare const QueuesOptionsSchema: z.ZodObject<{
    queueProducers: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodObject<{
        queueName: z.ZodString;
        deliveryDelay: z.ZodOptional<z.ZodNumber>;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString, z.ZodTypeDef, RemoteProxyConnectionString>>;
    }, "strip", z.ZodTypeAny, {
        queueName: string;
        deliveryDelay?: number | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }, {
        queueName: string;
        deliveryDelay?: number | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }>>, z.ZodArray<z.ZodString, "many">, z.ZodRecord<z.ZodString, z.ZodString>]>>;
    queueConsumers: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodEffects<z.ZodObject<{
        maxBatchSize: z.ZodOptional<z.ZodNumber>;
        maxBatchTimeout: z.ZodOptional<z.ZodNumber>;
        maxRetires: z.ZodOptional<z.ZodNumber>;
        maxRetries: z.ZodOptional<z.ZodNumber>;
        deadLetterQueue: z.ZodOptional<z.ZodString>;
        retryDelay: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        maxBatchSize?: number | undefined;
        maxBatchTimeout?: number | undefined;
        maxRetires?: number | undefined;
        maxRetries?: number | undefined;
        deadLetterQueue?: string | undefined;
        retryDelay?: number | undefined;
    }, {
        maxBatchSize?: number | undefined;
        maxBatchTimeout?: number | undefined;
        maxRetires?: number | undefined;
        maxRetries?: number | undefined;
        deadLetterQueue?: string | undefined;
        retryDelay?: number | undefined;
    }>, Omit<{
        maxBatchSize?: number | undefined;
        maxBatchTimeout?: number | undefined;
        maxRetires?: number | undefined;
        maxRetries?: number | undefined;
        deadLetterQueue?: string | undefined;
        retryDelay?: number | undefined;
    }, "maxRetires">, {
        maxBatchSize?: number | undefined;
        maxBatchTimeout?: number | undefined;
        maxRetires?: number | undefined;
        maxRetries?: number | undefined;
        deadLetterQueue?: string | undefined;
        retryDelay?: number | undefined;
    }>>, z.ZodArray<z.ZodString, "many">]>>;
}, "strip", z.ZodTypeAny, {
    queueProducers?: string[] | Record<string, string> | Record<string, {
        queueName: string;
        deliveryDelay?: number | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
    queueConsumers?: string[] | Record<string, Omit<{
        maxBatchSize?: number | undefined;
        maxBatchTimeout?: number | undefined;
        maxRetires?: number | undefined;
        maxRetries?: number | undefined;
        deadLetterQueue?: string | undefined;
        retryDelay?: number | undefined;
    }, "maxRetires">> | undefined;
}, {
    queueProducers?: string[] | Record<string, string> | Record<string, {
        queueName: string;
        deliveryDelay?: number | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
    queueConsumers?: string[] | Record<string, {
        maxBatchSize?: number | undefined;
        maxBatchTimeout?: number | undefined;
        maxRetires?: number | undefined;
        maxRetries?: number | undefined;
        deadLetterQueue?: string | undefined;
        retryDelay?: number | undefined;
    }> | undefined;
}>;

export declare type QueuesOutgoingBatchRequest = z.input<typeof QueuesBatchRequestSchema>;

export declare const R2_PLUGIN: Plugin<typeof R2OptionsSchema, typeof R2SharedOptionsSchema>;

export declare const R2_PLUGIN_NAME = "r2";

export declare const R2OptionsSchema: z.ZodObject<{
    r2Buckets: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodString>, z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString, z.ZodTypeDef, RemoteProxyConnectionString>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }, {
        id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }>>, z.ZodArray<z.ZodString, "many">]>>;
}, "strip", z.ZodTypeAny, {
    r2Buckets?: string[] | Record<string, string> | Record<string, {
        id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
}, {
    r2Buckets?: string[] | Record<string, string> | Record<string, {
        id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
}>;

export declare const R2SharedOptionsSchema: z.ZodObject<{
    r2Persist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
}, "strip", z.ZodTypeAny, {
    r2Persist?: string | boolean | undefined;
}, {
    r2Persist?: string | boolean | undefined;
}>;

export declare const RATELIMIT_PLUGIN: Plugin<typeof RatelimitOptionsSchema>;

export declare const RATELIMIT_PLUGIN_NAME = "ratelimit";

export declare const RatelimitConfigSchema: z.ZodObject<{
    simple: z.ZodObject<{
        limit: z.ZodNumber;
        period: z.ZodOptional<z.ZodNativeEnum<typeof PeriodType>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        period?: PeriodType | undefined;
    }, {
        limit: number;
        period?: PeriodType | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    simple: {
        limit: number;
        period?: PeriodType | undefined;
    };
}, {
    simple: {
        limit: number;
        period?: PeriodType | undefined;
    };
}>;

export declare const RatelimitOptionsSchema: z.ZodObject<{
    ratelimits: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        simple: z.ZodObject<{
            limit: z.ZodNumber;
            period: z.ZodOptional<z.ZodNativeEnum<typeof PeriodType>>;
        }, "strip", z.ZodTypeAny, {
            limit: number;
            period?: PeriodType | undefined;
        }, {
            limit: number;
            period?: PeriodType | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        simple: {
            limit: number;
            period?: PeriodType | undefined;
        };
    }, {
        simple: {
            limit: number;
            period?: PeriodType | undefined;
        };
    }>>>;
}, "strip", z.ZodTypeAny, {
    ratelimits?: Record<string, {
        simple: {
            limit: number;
            period?: PeriodType | undefined;
        };
    }> | undefined;
}, {
    ratelimits?: Record<string, {
        simple: {
            limit: number;
            period?: PeriodType | undefined;
        };
    }> | undefined;
}>;

export declare function readPrefix(stream: ReadableStream_3<Uint8Array>, prefixLength: number): Promise<[prefix: Buffer, rest: ReadableStream_3<Uint8Array>]>;

export declare function reduceError(e: any): JsonError;

export declare type ReducerReviver = (value: unknown) => unknown;

export declare type ReducersRevivers = Record<string, ReducerReviver>;

export { ReferrerPolicy }

export declare function remoteProxyClientWorker(remoteProxyConnectionString: RemoteProxyConnectionString | undefined, binding: string): {
    compatibilityDate: string;
    modules: {
        name: string;
        esModule: string;
    }[];
    bindings: {
        name: string;
        text: string;
    }[];
};

export declare type RemoteProxyConnectionString = URL & {
    __brand: "RemoteProxyConnectionString";
};

export declare type ReplaceWorkersTypes<T> = T extends Request_5 ? Request_2 : T extends Response_5 ? Response_2 : T extends ReadableStream_2 ? ReadableStream_3 : Required<T> extends Required<RequestInit_4> ? RequestInit_2 : T extends Headers_3 ? Headers_2 : T extends Blob_2 ? Blob_3 : T extends AbortSignal_2 ? AbortSignal : T extends Promise<infer P> ? Promise<ReplaceWorkersTypes<P>> : T extends (...args: infer P) => infer R ? (...args: ReplaceWorkersTypes<P>) => ReplaceWorkersTypes<R> : T extends object ? {
    [K in keyof T]: OverloadReplaceWorkersTypes<T[K]>;
} : T;

declare class Request_2<CfType extends RequestInitCfType = RequestInitCfType> extends Request_4 {
    [kCf]?: CfType;
    constructor(input: RequestInfo, init?: RequestInit_2<CfType>);
    get cf(): CfType | undefined;
    /** @ts-expect-error `clone` is actually defined as a method internally */
    clone(): Request_2<CfType>;
}
export { Request_2 as Request }

export { RequestCache }

export { RequestCredentials }

export { RequestDestination }

export { RequestDuplex }

export declare type RequestInfo = RequestInfo_2 | Request_2;

declare interface RequestInit_2<CfType extends RequestInitCfType = RequestInitCfType> extends RequestInit_3 {
    cf?: CfType;
}
export { RequestInit_2 as RequestInit }

export declare type RequestInitCfType = Partial<IncomingRequestCfProperties> | RequestInitCfProperties;

export { RequestMode }

export { RequestRedirect }

declare class Response_2 extends Response_4 {
    readonly [kWebSocket]: WebSocket | null;
    static error(): Response_2;
    static redirect(url: string | URL, status: ResponseRedirectStatus): Response_2;
    static json(data: any, init?: ResponseInit_2): Response_2;
    constructor(body?: BodyInit, init?: ResponseInit_2);
    /** @ts-expect-error `status` is actually defined as a getter internally */
    get status(): number;
    get webSocket(): WebSocket | null;
    /** @ts-expect-error `clone` is actually defined as a method internally */
    clone(): Response_2;
}
export { Response_2 as Response }

declare interface ResponseInit_2 extends ResponseInit_3 {
    webSocket?: WebSocket | null;
}
export { ResponseInit_2 as ResponseInit }

export { ResponseRedirectStatus }

export { ResponseType }

export declare class RouterError extends MiniflareError<RouterErrorCode> {
}

export declare type RouterErrorCode = "ERR_QUERY_STRING" | "ERR_INFIX_WILDCARD";

export declare class Runtime {
    #private;
    updateConfig(configBuffer: Buffer, options: Abortable & RuntimeOptions, workerNames: string[], abortSignal: AbortSignal): Promise<SocketPorts | undefined>;
    dispose(): Awaitable<void>;
}

export declare interface RuntimeOptions {
    entryAddress: string;
    loopbackAddress: string;
    requiredSockets: SocketIdentifier[];
    inspectorAddress?: string;
    verbose?: boolean;
    handleRuntimeStdio?: (stdout: Readable, stderr: Readable) => void;
    handleStructuredLogs?: StructuredLogsHandler;
}

export declare function sanitisePath(unsafe: string): string;

export declare const SECRET_STORE_PLUGIN: Plugin<typeof SecretsStoreSecretsOptionsSchema, typeof SecretsStoreSecretsSharedOptionsSchema>;

export declare const SECRET_STORE_PLUGIN_NAME = "secrets-store";

export declare const SecretsStoreSecretsOptionsSchema: z.ZodObject<{
    secretsStoreSecrets: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        store_id: z.ZodString;
        secret_name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        store_id: string;
        secret_name: string;
    }, {
        store_id: string;
        secret_name: string;
    }>>>;
}, "strip", z.ZodTypeAny, {
    secretsStoreSecrets?: Record<string, {
        store_id: string;
        secret_name: string;
    }> | undefined;
}, {
    secretsStoreSecrets?: Record<string, {
        store_id: string;
        secret_name: string;
    }> | undefined;
}>;

export declare const SecretsStoreSecretsSharedOptionsSchema: z.ZodObject<{
    secretsStorePersist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
}, "strip", z.ZodTypeAny, {
    secretsStorePersist?: string | boolean | undefined;
}, {
    secretsStorePersist?: string | boolean | undefined;
}>;

export declare interface SerialisableMatcherRegExps {
    include: string[];
    exclude: string[];
}

export declare interface SerialisableSiteMatcherRegExps {
    include?: SerialisableMatcherRegExps;
    exclude?: SerialisableMatcherRegExps;
}

export declare function serialiseRegExps(matcher: MatcherRegExps): SerialisableMatcherRegExps;

export declare function serialiseSiteRegExps(siteRegExps: SiteMatcherRegExps): SerialisableSiteMatcherRegExps;

export declare function serializeConfig(config: Config): Buffer;

export declare type Service = {
    name?: string;
} & ({
    worker?: Worker;
} | {
    network?: Network;
} | {
    external?: ExternalServer;
} | {
    disk?: DiskDirectory;
});

export declare const SERVICE_ENTRY = "core:entry";

export declare const SERVICE_LOOPBACK = "loopback";

export declare interface ServiceDesignator {
    name?: string;
    entrypoint?: string;
    props?: {
        json: string;
    };
}

export declare interface ServicesExtensions {
    services: Service[];
    extensions: Extension[];
}

export declare const SharedBindings: {
    readonly TEXT_NAMESPACE: "MINIFLARE_NAMESPACE";
    readonly DURABLE_OBJECT_NAMESPACE_OBJECT: "MINIFLARE_OBJECT";
    readonly MAYBE_SERVICE_BLOBS: "MINIFLARE_BLOBS";
    readonly MAYBE_SERVICE_LOOPBACK: "MINIFLARE_LOOPBACK";
    readonly MAYBE_JSON_ENABLE_CONTROL_ENDPOINTS: "MINIFLARE_ENABLE_CONTROL_ENDPOINTS";
    readonly MAYBE_JSON_ENABLE_STICKY_BLOBS: "MINIFLARE_STICKY_BLOBS";
};

export declare const SharedHeaders: {
    readonly LOG_LEVEL: "MF-Log-Level";
};

export declare type SharedOptions = z.input<typeof CORE_PLUGIN.sharedOptions> & z.input<typeof CACHE_PLUGIN.sharedOptions> & z.input<typeof D1_PLUGIN.sharedOptions> & z.input<typeof DURABLE_OBJECTS_PLUGIN.sharedOptions> & z.input<typeof KV_PLUGIN.sharedOptions> & z.input<typeof R2_PLUGIN.sharedOptions> & z.input<typeof WORKFLOWS_PLUGIN.sharedOptions> & z.input<typeof SECRET_STORE_PLUGIN.sharedOptions> & z.input<typeof ANALYTICS_ENGINE_PLUGIN.sharedOptions> & z.input<typeof HELLO_WORLD_PLUGIN.sharedOptions>;

export declare const SiteBindings: {
    readonly KV_NAMESPACE_SITE: "__STATIC_CONTENT";
    readonly JSON_SITE_MANIFEST: "__STATIC_CONTENT_MANIFEST";
    readonly JSON_SITE_FILTER: "MINIFLARE_SITE_FILTER";
};

export declare interface SiteMatcherRegExps {
    include?: MatcherRegExps;
    exclude?: MatcherRegExps;
}

export declare const SITES_NO_CACHE_PREFIX = "$__MINIFLARE_SITES__$/";

export declare type Socket = {
    name?: string;
    address?: string;
    service?: ServiceDesignator;
} & ({
    http?: HttpOptions;
} | {
    https?: Socket_Https;
});

export declare const SOCKET_ENTRY = "entry";

export declare const SOCKET_ENTRY_LOCAL = "entry:local";

export declare interface Socket_Https {
    options?: HttpOptions;
    tlsOptions?: TlsOptions;
}

export declare type SocketIdentifier = string | typeof kInspectorSocket;

export declare type SocketPorts = Map<SocketIdentifier, number>;

export declare type SourceOptions = z.infer<typeof SourceOptionsSchema>;

export declare const SourceOptionsSchema: z.ZodUnion<[z.ZodObject<{
    modules: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["ESModule", "CommonJS", "Text", "Data", "CompiledWasm", "PythonModule", "PythonRequirement"]>;
        path: z.ZodEffects<z.ZodString, string, string>;
        contents: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodType<Uint8Array<ArrayBuffer>, z.ZodTypeDef, Uint8Array<ArrayBuffer>>]>>;
    }, "strip", z.ZodTypeAny, {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        path: string;
        contents?: string | Uint8Array<ArrayBuffer> | undefined;
    }, {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        path: string;
        contents?: string | Uint8Array<ArrayBuffer> | undefined;
    }>, "many">;
    modulesRoot: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strip", z.ZodTypeAny, {
    modules: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        path: string;
        contents?: string | Uint8Array<ArrayBuffer> | undefined;
    }[];
    modulesRoot?: string | undefined;
}, {
    modules: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        path: string;
        contents?: string | Uint8Array<ArrayBuffer> | undefined;
    }[];
    modulesRoot?: string | undefined;
}>, z.ZodObject<{
    script: z.ZodString;
    scriptPath: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    modules: z.ZodOptional<z.ZodBoolean>;
    modulesRules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["ESModule", "CommonJS", "Text", "Data", "CompiledWasm", "PythonModule", "PythonRequirement"]>;
        include: z.ZodArray<z.ZodString, "many">;
        fallthrough: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }, {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }>, "many">>;
    modulesRoot: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strip", z.ZodTypeAny, {
    script: string;
    scriptPath?: string | undefined;
    modules?: boolean | undefined;
    modulesRules?: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
}, {
    script: string;
    scriptPath?: string | undefined;
    modules?: boolean | undefined;
    modulesRules?: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
}>, z.ZodObject<{
    scriptPath: z.ZodEffects<z.ZodString, string, string>;
    modules: z.ZodOptional<z.ZodBoolean>;
    modulesRules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["ESModule", "CommonJS", "Text", "Data", "CompiledWasm", "PythonModule", "PythonRequirement"]>;
        include: z.ZodArray<z.ZodString, "many">;
        fallthrough: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }, {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }>, "many">>;
    modulesRoot: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strip", z.ZodTypeAny, {
    scriptPath: string;
    modules?: boolean | undefined;
    modulesRules?: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
}, {
    scriptPath: string;
    modules?: boolean | undefined;
    modulesRules?: {
        type: "ESModule" | "CommonJS" | "Text" | "Data" | "CompiledWasm" | "PythonModule" | "PythonRequirement";
        include: string[];
        fallthrough?: boolean | undefined;
    }[] | undefined;
    modulesRoot?: string | undefined;
}>]>;

export declare interface StringifiedWithStream<RS> {
    value: string;
    unbufferedStream?: RS;
}

export declare function stringifyWithStreams<RS>(impl: PlatformImpl<RS>, value: unknown, reducers: ReducersRevivers, allowUnbufferedStream: boolean): StringifiedWithStream<RS> | Promise<StringifiedWithStream<RS>>;

export declare function stripAnsi(value: string): string;

export declare type StructuredLogsHandler = (structuredLog: WorkerdStructuredLog) => void;

export declare const structuredSerializableReducers: ReducersRevivers;

export declare const structuredSerializableRevivers: ReducersRevivers;

export { supportedCompatibilityDate }

export declare const SYSTEM_ERROR_CODES: Set<"ERR_RUNTIME_FAILURE" | "ERR_CYCLIC" | "ERR_PLUGIN_LOADING_FAILED">;

export declare function testRegExps(matcher: MatcherRegExps, value: string): boolean;

export declare function testSiteRegExps(regExps: SiteMatcherRegExps, key: string): boolean;

export declare interface TlsOptions {
    keypair?: TlsOptions_Keypair;
    requireClientCerts?: boolean;
    trustBrowserCas?: boolean;
    trustedCertificates?: string[];
    minVersion?: TlsOptions_Version;
    cipherList?: string;
}

export declare interface TlsOptions_Keypair {
    privateKey?: string;
    certificateChain?: string;
}

export declare const TlsOptions_Version: {
    /**
     * A good default chosen by the code maintainers. May change over time.
     *
     */
    readonly GOOD_DEFAULT: 0;
    readonly SSL3: 1;
    readonly TLS1DOT0: 2;
    readonly TLS1DOT1: 3;
    readonly TLS1DOT2: 4;
    readonly TLS1DOT3: 5;
};

export declare type TlsOptions_Version = (typeof TlsOptions_Version)[keyof typeof TlsOptions_Version];

export declare function _transformsForContentEncodingAndContentType(encoding: string | undefined, type: string | undefined | null): Transform[];

export declare type TypedEventListener<E extends Event> = ((e: E) => void) | {
    handleEvent(e: E): void;
};

export declare class TypedEventTarget<EventMap extends Record<string, Event>> extends EventTarget {
    addEventListener<Type extends keyof EventMap>(type: Type, listener: TypedEventListener<EventMap[Type]> | null, options?: AddEventListenerOptions | boolean): void;
    removeEventListener<Type extends keyof EventMap>(type: Type, listener: TypedEventListener<EventMap[Type]> | null, options?: EventListenerOptions | boolean): void;
    dispatchEvent(event: ValueOf<EventMap>): boolean;
}

export declare type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

export declare type UnsafeUniqueKey = string | typeof kUnsafeEphemeralUniqueKey;

export declare const USER_ERROR_CODES: Set<"ERR_ADDRESS_IN_USE" | "ERR_DISPOSED" | "ERR_MODULE_PARSE" | "ERR_MODULE_STRING_SCRIPT" | "ERR_MODULE_DYNAMIC_SPEC" | "ERR_MODULE_RULE" | "ERR_PERSIST_UNSUPPORTED" | "ERR_FUTURE_COMPATIBILITY_DATE" | "ERR_NO_WORKERS" | "ERR_VALIDATION" | "ERR_DUPLICATE_NAME" | "ERR_DIFFERENT_STORAGE_BACKEND" | "ERR_DIFFERENT_UNIQUE_KEYS" | "ERR_DIFFERENT_PREVENT_EVICTION" | "ERR_MULTIPLE_OUTBOUNDS" | "ERR_INVALID_WRAPPED" | "ERR_MISSING_INSPECTOR_PROXY_PORT">;

export declare type ValueOf<T> = T[keyof T];

export declare const VECTORIZE_PLUGIN: Plugin<typeof VectorizeOptionsSchema>;

export declare const VECTORIZE_PLUGIN_NAME = "vectorize";

export declare const VectorizeOptionsSchema: z.ZodObject<{
    vectorize: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        index_name: z.ZodString;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString, z.ZodTypeDef, RemoteProxyConnectionString>>;
    }, "strip", z.ZodTypeAny, {
        index_name: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }, {
        index_name: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    vectorize?: Record<string, {
        index_name: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
}, {
    vectorize?: Record<string, {
        index_name: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
}>;

export declare function viewToBuffer(view: ArrayBufferView): ArrayBuffer;

export declare type Void = typeof kVoid;

export declare const VPC_SERVICES_PLUGIN: Plugin<typeof VpcServicesOptionsSchema>;

export declare const VPC_SERVICES_PLUGIN_NAME = "vpc-services";

export declare const VpcServicesOptionsSchema: z.ZodObject<{
    vpcServices: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        service_id: z.ZodString;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString, z.ZodTypeDef, RemoteProxyConnectionString>>;
    }, "strip", z.ZodTypeAny, {
        service_id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }, {
        service_id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    vpcServices?: Record<string, {
        service_id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
}, {
    vpcServices?: Record<string, {
        service_id: string;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
}>;

export declare class WaitGroup {
    private counter;
    private resolveQueue;
    add(): void;
    done(): void;
    wait(): Promise<void>;
}

export declare class WebSocket extends TypedEventTarget<WebSocketEventMap> {
    #private;
    static readonly READY_STATE_CONNECTING = 0;
    static readonly READY_STATE_OPEN = 1;
    static readonly READY_STATE_CLOSING = 2;
    static readonly READY_STATE_CLOSED = 3;
    [kPair]?: WebSocket;
    [kAccepted]: boolean;
    [kCoupled]: boolean;
    [kClosedOutgoing]: boolean;
    [kClosedIncoming]: boolean;
    get readyState(): number;
    accept(): void;
    send(message: string | ArrayBuffer | Uint8Array<ArrayBuffer>): void;
    [kSend](message: string | ArrayBuffer | Uint8Array<ArrayBuffer>): void;
    close(code?: number, reason?: string): void;
    [kClose](code?: number, reason?: string): void;
    [kError](error?: Error): void;
}

export declare type WebSocketEventMap = {
    message: MessageEvent_2;
    close: CloseEvent;
    error: ErrorEvent;
};

export declare type WebSocketPair = {
    0: WebSocket;
    1: WebSocket;
};

export declare const WebSocketPair: {
    new (): WebSocketPair;
};

export declare type Worker = ({
    modules?: Worker_Module[];
} | {
    serviceWorkerScript?: string;
} | {
    inherit?: string;
}) & {
    compatibilityDate?: string;
    compatibilityFlags?: string[];
    bindings?: Worker_Binding[];
    globalOutbound?: ServiceDesignator;
    cacheApiOutbound?: ServiceDesignator;
    durableObjectNamespaces?: Worker_DurableObjectNamespace[];
    durableObjectUniqueKeyModifier?: string;
    durableObjectStorage?: Worker_DurableObjectStorage;
    moduleFallback?: string;
    tails?: ServiceDesignator[];
    streamingTails?: ServiceDesignator[];
    containerEngine?: Worker_ContainerEngine;
};

export declare type Worker_Binding = {
    name?: string;
} & ({
    parameter?: Worker_Binding_Parameter;
} | {
    text?: string;
} | {
    data?: Uint8Array;
} | {
    json?: string;
} | {
    wasmModule?: Uint8Array;
} | {
    cryptoKey?: Worker_Binding_CryptoKey;
} | {
    service?: ServiceDesignator;
} | {
    durableObjectNamespace?: Worker_Binding_DurableObjectNamespaceDesignator;
} | {
    kvNamespace?: ServiceDesignator;
} | {
    r2Bucket?: ServiceDesignator;
} | {
    r2Admin?: ServiceDesignator;
} | {
    wrapped?: Worker_Binding_WrappedBinding;
} | {
    queue?: ServiceDesignator;
} | {
    fromEnvironment?: string;
} | {
    analyticsEngine?: ServiceDesignator;
} | {
    hyperdrive?: Worker_Binding_Hyperdrive;
} | {
    unsafeEval?: Void;
} | {
    workerLoader?: Worker_Binding_WorkerLoader;
});

export declare type Worker_Binding_CryptoKey = ({
    raw?: Uint8Array;
} | {
    hex?: string;
} | {
    base64?: string;
} | {
    pkcs8?: string;
} | {
    spki?: string;
} | {
    jwk?: string;
}) & {
    algorithm?: Worker_Binding_CryptoKey_Algorithm;
    extractable?: boolean;
    usages?: Worker_Binding_CryptoKey_Usage[];
};

export declare type Worker_Binding_CryptoKey_Algorithm = {
    name?: string;
} | {
    json?: string;
};

export declare const Worker_Binding_CryptoKey_Usage: {
    readonly ENCRYPT: 0;
    readonly DECRYPT: 1;
    readonly SIGN: 2;
    readonly VERIFY: 3;
    readonly DERIVE_KEY: 4;
    readonly DERIVE_BITS: 5;
    readonly WRAP_KEY: 6;
    readonly UNWRAP_KEY: 7;
};

export declare type Worker_Binding_CryptoKey_Usage = (typeof Worker_Binding_CryptoKey_Usage)[keyof typeof Worker_Binding_CryptoKey_Usage];

export declare type Worker_Binding_DurableObjectNamespaceDesignator = {
    className?: string;
    serviceName?: string;
};

export declare interface Worker_Binding_Hyperdrive {
    designator?: ServiceDesignator;
    database?: string;
    user?: string;
    password?: string;
    scheme?: string;
}

export declare interface Worker_Binding_MemoryCache {
    id?: string;
    limits?: Worker_Binding_MemoryCacheLimits;
}

export declare interface Worker_Binding_MemoryCacheLimits {
    maxKeys?: number;
    maxValueSize?: number;
    maxTotalValueSize?: number;
}

export declare interface Worker_Binding_Parameter {
    type?: Worker_Binding_Type;
    optional?: boolean;
}

export declare const WORKER_BINDING_SERVICE_LOOPBACK: Worker_Binding;

export declare type Worker_Binding_Type = {
    text?: Void;
} | {
    data?: Void;
} | {
    json?: Void;
} | {
    wasm?: Void;
} | {
    cryptoKey?: Worker_Binding_CryptoKey_Usage[];
} | {
    service?: Void;
} | {
    durableObjectNamespace: Void;
} | {
    kvNamespace?: Void;
} | {
    r2Bucket?: Void;
} | {
    r2Admin?: Void;
} | {
    queue?: Void;
} | {
    analyticsEngine?: Void;
} | {
    hyperdrive?: Void;
};

export declare interface Worker_Binding_WorkerLoader {
    id?: string;
}

export declare interface Worker_Binding_WrappedBinding {
    moduleName?: string;
    entrypoint?: string;
    innerBindings?: Worker_Binding[];
}

export declare type Worker_ContainerEngine = {
    localDocker: Worker_DockerConfiguration;
};

export declare type Worker_DockerConfiguration = {
    socketPath: string;
};

export declare type Worker_DurableObjectNamespace = {
    className?: string;
    preventEviction?: boolean;
    enableSql?: boolean;
} & ({
    uniqueKey?: string;
} | {
    ephemeralLocal?: Void;
});

export declare type Worker_DurableObjectStorage = {
    none?: Void;
} | {
    inMemory?: Void;
} | {
    localDisk?: string;
};

export declare const WORKER_LOADER_PLUGIN: Plugin<typeof WorkerLoaderOptionsSchema>;

export declare const WORKER_LOADER_PLUGIN_NAME = "worker-loader";

export declare type Worker_Module = {
    name: string;
} & ({
    esModule?: string;
} | {
    commonJsModule?: string;
} | {
    text?: string;
} | {
    data?: Uint8Array;
} | {
    wasm?: Uint8Array;
} | {
    json?: string;
} | {
    pythonModule?: string;
} | {
    pythonRequirement?: string;
});

export declare type WorkerDefinition = {
    protocol: "http" | "https";
    host: string;
    port: number;
    entrypointAddresses: Record<"default" | string, {
        host: string;
        port: number;
    } | undefined>;
    durableObjects: {
        name: string;
        className: string;
    }[];
};

export declare type WorkerdStructuredLog = z.infer<typeof workerdStructuredLogSchema>;

export declare const workerdStructuredLogSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    level: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    timestamp: number;
    level: string;
}, {
    message: string;
    timestamp: number;
    level: string;
}>;

export declare const WorkerLoaderConfigSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;

export declare const WorkerLoaderOptionsSchema: z.ZodObject<{
    workerLoaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>>>;
}, "strip", z.ZodTypeAny, {
    workerLoaders?: Record<string, {}> | undefined;
}, {
    workerLoaders?: Record<string, {}> | undefined;
}>;

export declare type WorkerOptions = z.input<typeof CORE_PLUGIN.options> & z.input<typeof CACHE_PLUGIN.options> & z.input<typeof D1_PLUGIN.options> & z.input<typeof DURABLE_OBJECTS_PLUGIN.options> & z.input<typeof KV_PLUGIN.options> & z.input<typeof QUEUES_PLUGIN.options> & z.input<typeof R2_PLUGIN.options> & z.input<typeof HYPERDRIVE_PLUGIN.options> & z.input<typeof RATELIMIT_PLUGIN.options> & z.input<typeof EMAIL_PLUGIN.options> & z.input<typeof ASSETS_PLUGIN.options> & z.input<typeof WORKFLOWS_PLUGIN.options> & z.input<typeof PIPELINE_PLUGIN.options> & z.input<typeof SECRET_STORE_PLUGIN.options> & z.input<typeof ANALYTICS_ENGINE_PLUGIN.options> & z.input<typeof AI_PLUGIN.options> & z.input<typeof BROWSER_RENDERING_PLUGIN.options> & z.input<typeof DISPATCH_NAMESPACE_PLUGIN.options> & z.input<typeof IMAGES_PLUGIN.options> & z.input<typeof VECTORIZE_PLUGIN.options> & z.input<typeof VPC_SERVICES_PLUGIN.options> & z.input<typeof MTLS_PLUGIN.options> & z.input<typeof HELLO_WORLD_PLUGIN.options> & z.input<typeof WORKER_LOADER_PLUGIN.options> & z.input<typeof MEDIA_PLUGIN.options>;

export declare type WorkerRegistry = Record<string, WorkerDefinition>;

export declare interface WorkerRoute {
    target: string;
    route: string;
    specificity: number;
    protocol?: string;
    allowHostnamePrefix: boolean;
    hostname: string;
    path: string;
    allowPathSuffix: boolean;
}

export declare const WORKFLOWS_PLUGIN: Plugin<typeof WorkflowsOptionsSchema, typeof WorkflowsSharedOptionsSchema>;

export declare const WORKFLOWS_PLUGIN_NAME = "workflows";

export declare const WORKFLOWS_STORAGE_SERVICE_NAME = "workflows:storage";

export declare const WorkflowsOptionsSchema: z.ZodObject<{
    workflows: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        name: z.ZodString;
        className: z.ZodString;
        scriptName: z.ZodOptional<z.ZodString>;
        remoteProxyConnectionString: z.ZodOptional<z.ZodType<RemoteProxyConnectionString, z.ZodTypeDef, RemoteProxyConnectionString>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        className: string;
        scriptName?: string | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }, {
        name: string;
        className: string;
        scriptName?: string | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    workflows?: Record<string, {
        name: string;
        className: string;
        scriptName?: string | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
}, {
    workflows?: Record<string, {
        name: string;
        className: string;
        scriptName?: string | undefined;
        remoteProxyConnectionString?: RemoteProxyConnectionString | undefined;
    }> | undefined;
}>;

export declare const WorkflowsSharedOptionsSchema: z.ZodObject<{
    workflowsPersist: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodEffects<z.ZodString, string, string>]>>;
}, "strip", z.ZodTypeAny, {
    workflowsPersist?: string | boolean | undefined;
}, {
    workflowsPersist?: string | boolean | undefined;
}>;

export declare type WrappedBindingNames = Set<string>;

export declare function zAwaitable<T extends z.ZodTypeAny>(type: T): z.ZodUnion<[T, z.ZodPromise<T>]>;

export { }
