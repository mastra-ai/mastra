import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class Managed extends APIResource {
    /**
     * Updates state of public access over the bucket's R2-managed (r2.dev) domain.
     *
     * @example
     * ```ts
     * const managed =
     *   await client.r2.buckets.domains.managed.update(
     *     'example-bucket',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       enabled: true,
     *     },
     *   );
     * ```
     */
    update(bucketName: string, params: ManagedUpdateParams, options?: Core.RequestOptions): Core.APIPromise<ManagedUpdateResponse>;
    /**
     * Gets state of public access over the bucket's R2-managed (r2.dev) domain.
     *
     * @example
     * ```ts
     * const manageds =
     *   await client.r2.buckets.domains.managed.list(
     *     'example-bucket',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    list(bucketName: string, params: ManagedListParams, options?: Core.RequestOptions): Core.APIPromise<ManagedListResponse>;
}
export interface ManagedUpdateResponse {
    /**
     * Bucket ID.
     */
    bucketId: string;
    /**
     * Domain name of the bucket's r2.dev domain.
     */
    domain: string;
    /**
     * Whether this bucket is publicly accessible at the r2.dev domain.
     */
    enabled: boolean;
}
export interface ManagedListResponse {
    /**
     * Bucket ID.
     */
    bucketId: string;
    /**
     * Domain name of the bucket's r2.dev domain.
     */
    domain: string;
    /**
     * Whether this bucket is publicly accessible at the r2.dev domain.
     */
    enabled: boolean;
}
export interface ManagedUpdateParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Body param: Whether to enable public bucket access at the r2.dev domain.
     */
    enabled: boolean;
    /**
     * Header param: Jurisdiction where objects in this bucket are guaranteed to be
     * stored.
     */
    jurisdiction?: 'default' | 'eu' | 'fedramp';
}
export interface ManagedListParams {
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
export declare namespace Managed {
    export { type ManagedUpdateResponse as ManagedUpdateResponse, type ManagedListResponse as ManagedListResponse, type ManagedUpdateParams as ManagedUpdateParams, type ManagedListParams as ManagedListParams, };
}
//# sourceMappingURL=managed.d.ts.map