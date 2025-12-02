import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class Custom extends APIResource {
    /**
     * Register a new custom domain for an existing R2 bucket.
     *
     * @example
     * ```ts
     * const custom =
     *   await client.r2.buckets.domains.custom.create(
     *     'example-bucket',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       domain: 'prefix.example-domain.com',
     *       enabled: true,
     *       zoneId: '36ca64a6d92827b8a6b90be344bb1bfd',
     *     },
     *   );
     * ```
     */
    create(bucketName: string, params: CustomCreateParams, options?: Core.RequestOptions): Core.APIPromise<CustomCreateResponse>;
    /**
     * Edit the configuration for a custom domain on an existing R2 bucket.
     *
     * @example
     * ```ts
     * const custom =
     *   await client.r2.buckets.domains.custom.update(
     *     'example-bucket',
     *     'example-domain/custom-domain.com',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    update(bucketName: string, domain: string, params: CustomUpdateParams, options?: Core.RequestOptions): Core.APIPromise<CustomUpdateResponse>;
    /**
     * Gets a list of all custom domains registered with an existing R2 bucket.
     *
     * @example
     * ```ts
     * const customs = await client.r2.buckets.domains.custom.list(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    list(bucketName: string, params: CustomListParams, options?: Core.RequestOptions): Core.APIPromise<CustomListResponse>;
    /**
     * Remove custom domain registration from an existing R2 bucket.
     *
     * @example
     * ```ts
     * const custom =
     *   await client.r2.buckets.domains.custom.delete(
     *     'example-bucket',
     *     'example-domain/custom-domain.com',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(bucketName: string, domain: string, params: CustomDeleteParams, options?: Core.RequestOptions): Core.APIPromise<CustomDeleteResponse>;
    /**
     * Get the configuration for a custom domain on an existing R2 bucket.
     *
     * @example
     * ```ts
     * const custom = await client.r2.buckets.domains.custom.get(
     *   'example-bucket',
     *   'example-domain/custom-domain.com',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(bucketName: string, domain: string, params: CustomGetParams, options?: Core.RequestOptions): Core.APIPromise<CustomGetResponse>;
}
export interface CustomCreateResponse {
    /**
     * Domain name of the affected custom domain.
     */
    domain: string;
    /**
     * Whether this bucket is publicly accessible at the specified custom domain.
     */
    enabled: boolean;
    /**
     * Minimum TLS Version the custom domain will accept for incoming connections. If
     * not set, defaults to 1.0.
     */
    minTLS?: '1.0' | '1.1' | '1.2' | '1.3';
}
export interface CustomUpdateResponse {
    /**
     * Domain name of the affected custom domain.
     */
    domain: string;
    /**
     * Whether this bucket is publicly accessible at the specified custom domain.
     */
    enabled?: boolean;
    /**
     * Minimum TLS Version the custom domain will accept for incoming connections. If
     * not set, defaults to 1.0.
     */
    minTLS?: '1.0' | '1.1' | '1.2' | '1.3';
}
export interface CustomListResponse {
    domains: Array<CustomListResponse.Domain>;
}
export declare namespace CustomListResponse {
    interface Domain {
        /**
         * Domain name of the custom domain to be added.
         */
        domain: string;
        /**
         * Whether this bucket is publicly accessible at the specified custom domain.
         */
        enabled: boolean;
        status: Domain.Status;
        /**
         * Minimum TLS Version the custom domain will accept for incoming connections. If
         * not set, defaults to 1.0.
         */
        minTLS?: '1.0' | '1.1' | '1.2' | '1.3';
        /**
         * Zone ID of the custom domain resides in.
         */
        zoneId?: string;
        /**
         * Zone that the custom domain resides in.
         */
        zoneName?: string;
    }
    namespace Domain {
        interface Status {
            /**
             * Ownership status of the domain.
             */
            ownership: 'pending' | 'active' | 'deactivated' | 'blocked' | 'error' | 'unknown';
            /**
             * SSL certificate status.
             */
            ssl: 'initializing' | 'pending' | 'active' | 'deactivated' | 'error' | 'unknown';
        }
    }
}
export interface CustomDeleteResponse {
    /**
     * Name of the removed custom domain.
     */
    domain: string;
}
export interface CustomGetResponse {
    /**
     * Domain name of the custom domain to be added.
     */
    domain: string;
    /**
     * Whether this bucket is publicly accessible at the specified custom domain.
     */
    enabled: boolean;
    status: CustomGetResponse.Status;
    /**
     * Minimum TLS Version the custom domain will accept for incoming connections. If
     * not set, defaults to 1.0.
     */
    minTLS?: '1.0' | '1.1' | '1.2' | '1.3';
    /**
     * Zone ID of the custom domain resides in.
     */
    zoneId?: string;
    /**
     * Zone that the custom domain resides in.
     */
    zoneName?: string;
}
export declare namespace CustomGetResponse {
    interface Status {
        /**
         * Ownership status of the domain.
         */
        ownership: 'pending' | 'active' | 'deactivated' | 'blocked' | 'error' | 'unknown';
        /**
         * SSL certificate status.
         */
        ssl: 'initializing' | 'pending' | 'active' | 'deactivated' | 'error' | 'unknown';
    }
}
export interface CustomCreateParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Body param: Name of the custom domain to be added.
     */
    domain: string;
    /**
     * Body param: Whether to enable public bucket access at the custom domain. If
     * undefined, the domain will be enabled.
     */
    enabled: boolean;
    /**
     * Body param: Zone ID of the custom domain.
     */
    zoneId: string;
    /**
     * Body param: Minimum TLS Version the custom domain will accept for incoming
     * connections. If not set, defaults to 1.0.
     */
    minTLS?: '1.0' | '1.1' | '1.2' | '1.3';
    /**
     * Header param: Jurisdiction where objects in this bucket are guaranteed to be
     * stored.
     */
    jurisdiction?: 'default' | 'eu' | 'fedramp';
}
export interface CustomUpdateParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Body param: Whether to enable public bucket access at the specified custom
     * domain.
     */
    enabled?: boolean;
    /**
     * Body param: Minimum TLS Version the custom domain will accept for incoming
     * connections. If not set, defaults to previous value.
     */
    minTLS?: '1.0' | '1.1' | '1.2' | '1.3';
    /**
     * Header param: Jurisdiction where objects in this bucket are guaranteed to be
     * stored.
     */
    jurisdiction?: 'default' | 'eu' | 'fedramp';
}
export interface CustomListParams {
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
export interface CustomDeleteParams {
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
export interface CustomGetParams {
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
export declare namespace Custom {
    export { type CustomCreateResponse as CustomCreateResponse, type CustomUpdateResponse as CustomUpdateResponse, type CustomListResponse as CustomListResponse, type CustomDeleteResponse as CustomDeleteResponse, type CustomGetResponse as CustomGetResponse, type CustomCreateParams as CustomCreateParams, type CustomUpdateParams as CustomUpdateParams, type CustomListParams as CustomListParams, type CustomDeleteParams as CustomDeleteParams, type CustomGetParams as CustomGetParams, };
}
//# sourceMappingURL=custom.d.ts.map