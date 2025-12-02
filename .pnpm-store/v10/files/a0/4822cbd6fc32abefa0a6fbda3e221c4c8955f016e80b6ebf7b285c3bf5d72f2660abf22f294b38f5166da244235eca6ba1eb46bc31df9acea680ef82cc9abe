import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class CORS extends APIResource {
    /**
     * Set the CORS policy for a bucket.
     *
     * @example
     * ```ts
     * const cors = await client.r2.buckets.cors.update(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(bucketName: string, params: CORSUpdateParams, options?: Core.RequestOptions): Core.APIPromise<CORSUpdateResponse>;
    /**
     * Delete the CORS policy for a bucket.
     *
     * @example
     * ```ts
     * const cors = await client.r2.buckets.cors.delete(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(bucketName: string, params: CORSDeleteParams, options?: Core.RequestOptions): Core.APIPromise<CORSDeleteResponse>;
    /**
     * Get the CORS policy for a bucket.
     *
     * @example
     * ```ts
     * const cors = await client.r2.buckets.cors.get(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(bucketName: string, params: CORSGetParams, options?: Core.RequestOptions): Core.APIPromise<CORSGetResponse>;
}
export type CORSUpdateResponse = unknown;
export type CORSDeleteResponse = unknown;
export interface CORSGetResponse {
    rules?: Array<CORSGetResponse.Rule>;
}
export declare namespace CORSGetResponse {
    interface Rule {
        /**
         * Object specifying allowed origins, methods and headers for this CORS rule.
         */
        allowed: Rule.Allowed;
        /**
         * Identifier for this rule.
         */
        id?: string;
        /**
         * Specifies the headers that can be exposed back, and accessed by, the JavaScript
         * making the cross-origin request. If you need to access headers beyond the
         * safelisted response headers, such as Content-Encoding or cf-cache-status, you
         * must specify it here.
         */
        exposeHeaders?: Array<string>;
        /**
         * Specifies the amount of time (in seconds) browsers are allowed to cache CORS
         * preflight responses. Browsers may limit this to 2 hours or less, even if the
         * maximum value (86400) is specified.
         */
        maxAgeSeconds?: number;
    }
    namespace Rule {
        /**
         * Object specifying allowed origins, methods and headers for this CORS rule.
         */
        interface Allowed {
            /**
             * Specifies the value for the Access-Control-Allow-Methods header R2 sets when
             * requesting objects in a bucket from a browser.
             */
            methods: Array<'GET' | 'PUT' | 'POST' | 'DELETE' | 'HEAD'>;
            /**
             * Specifies the value for the Access-Control-Allow-Origin header R2 sets when
             * requesting objects in a bucket from a browser.
             */
            origins: Array<string>;
            /**
             * Specifies the value for the Access-Control-Allow-Headers header R2 sets when
             * requesting objects in this bucket from a browser. Cross-origin requests that
             * include custom headers (e.g. x-user-id) should specify these headers as
             * AllowedHeaders.
             */
            headers?: Array<string>;
        }
    }
}
export interface CORSUpdateParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Body param:
     */
    rules?: Array<CORSUpdateParams.Rule>;
    /**
     * Header param: Jurisdiction where objects in this bucket are guaranteed to be
     * stored.
     */
    jurisdiction?: 'default' | 'eu' | 'fedramp';
}
export declare namespace CORSUpdateParams {
    interface Rule {
        /**
         * Object specifying allowed origins, methods and headers for this CORS rule.
         */
        allowed: Rule.Allowed;
        /**
         * Identifier for this rule.
         */
        id?: string;
        /**
         * Specifies the headers that can be exposed back, and accessed by, the JavaScript
         * making the cross-origin request. If you need to access headers beyond the
         * safelisted response headers, such as Content-Encoding or cf-cache-status, you
         * must specify it here.
         */
        exposeHeaders?: Array<string>;
        /**
         * Specifies the amount of time (in seconds) browsers are allowed to cache CORS
         * preflight responses. Browsers may limit this to 2 hours or less, even if the
         * maximum value (86400) is specified.
         */
        maxAgeSeconds?: number;
    }
    namespace Rule {
        /**
         * Object specifying allowed origins, methods and headers for this CORS rule.
         */
        interface Allowed {
            /**
             * Specifies the value for the Access-Control-Allow-Methods header R2 sets when
             * requesting objects in a bucket from a browser.
             */
            methods: Array<'GET' | 'PUT' | 'POST' | 'DELETE' | 'HEAD'>;
            /**
             * Specifies the value for the Access-Control-Allow-Origin header R2 sets when
             * requesting objects in a bucket from a browser.
             */
            origins: Array<string>;
            /**
             * Specifies the value for the Access-Control-Allow-Headers header R2 sets when
             * requesting objects in this bucket from a browser. Cross-origin requests that
             * include custom headers (e.g. x-user-id) should specify these headers as
             * AllowedHeaders.
             */
            headers?: Array<string>;
        }
    }
}
export interface CORSDeleteParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Header param: Jurisdiction where objects in this bucket are guaranteed to be
     * stored.
     */
    jurisdiction?: 'default' | 'eu' | 'fedramp';
}
export interface CORSGetParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Header param: Jurisdiction where objects in this bucket are guaranteed to be
     * stored.
     */
    jurisdiction?: 'default' | 'eu' | 'fedramp';
}
export declare namespace CORS {
    export { type CORSUpdateResponse as CORSUpdateResponse, type CORSDeleteResponse as CORSDeleteResponse, type CORSGetResponse as CORSGetResponse, type CORSUpdateParams as CORSUpdateParams, type CORSDeleteParams as CORSDeleteParams, type CORSGetParams as CORSGetParams, };
}
//# sourceMappingURL=cors.d.ts.map