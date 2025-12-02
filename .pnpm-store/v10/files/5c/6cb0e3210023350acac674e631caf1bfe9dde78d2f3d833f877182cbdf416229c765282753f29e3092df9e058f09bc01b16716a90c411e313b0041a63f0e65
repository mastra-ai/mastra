import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class FallbackOrigin extends APIResource {
    /**
     * Update Fallback Origin for Custom Hostnames
     *
     * @example
     * ```ts
     * const fallbackOrigin =
     *   await client.customHostnames.fallbackOrigin.update({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     origin: 'fallback.example.com',
     *   });
     * ```
     */
    update(params: FallbackOriginUpdateParams, options?: Core.RequestOptions): Core.APIPromise<FallbackOriginUpdateResponse>;
    /**
     * Delete Fallback Origin for Custom Hostnames
     *
     * @example
     * ```ts
     * const fallbackOrigin =
     *   await client.customHostnames.fallbackOrigin.delete({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    delete(params: FallbackOriginDeleteParams, options?: Core.RequestOptions): Core.APIPromise<FallbackOriginDeleteResponse>;
    /**
     * Get Fallback Origin for Custom Hostnames
     *
     * @example
     * ```ts
     * const fallbackOrigin =
     *   await client.customHostnames.fallbackOrigin.get({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params: FallbackOriginGetParams, options?: Core.RequestOptions): Core.APIPromise<FallbackOriginGetResponse>;
}
export interface FallbackOriginUpdateResponse {
    /**
     * This is the time the fallback origin was created.
     */
    created_at?: string;
    /**
     * These are errors that were encountered while trying to activate a fallback
     * origin.
     */
    errors?: Array<string>;
    /**
     * Your origin hostname that requests to your custom hostnames will be sent to.
     */
    origin?: string;
    /**
     * Status of the fallback origin's activation.
     */
    status?: 'initializing' | 'pending_deployment' | 'pending_deletion' | 'active' | 'deployment_timed_out' | 'deletion_timed_out';
    /**
     * This is the time the fallback origin was updated.
     */
    updated_at?: string;
}
export interface FallbackOriginDeleteResponse {
    /**
     * This is the time the fallback origin was created.
     */
    created_at?: string;
    /**
     * These are errors that were encountered while trying to activate a fallback
     * origin.
     */
    errors?: Array<string>;
    /**
     * Your origin hostname that requests to your custom hostnames will be sent to.
     */
    origin?: string;
    /**
     * Status of the fallback origin's activation.
     */
    status?: 'initializing' | 'pending_deployment' | 'pending_deletion' | 'active' | 'deployment_timed_out' | 'deletion_timed_out';
    /**
     * This is the time the fallback origin was updated.
     */
    updated_at?: string;
}
export interface FallbackOriginGetResponse {
    /**
     * This is the time the fallback origin was created.
     */
    created_at?: string;
    /**
     * These are errors that were encountered while trying to activate a fallback
     * origin.
     */
    errors?: Array<string>;
    /**
     * Your origin hostname that requests to your custom hostnames will be sent to.
     */
    origin?: string;
    /**
     * Status of the fallback origin's activation.
     */
    status?: 'initializing' | 'pending_deployment' | 'pending_deletion' | 'active' | 'deployment_timed_out' | 'deletion_timed_out';
    /**
     * This is the time the fallback origin was updated.
     */
    updated_at?: string;
}
export interface FallbackOriginUpdateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: Your origin hostname that requests to your custom hostnames will be
     * sent to.
     */
    origin: string;
}
export interface FallbackOriginDeleteParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export interface FallbackOriginGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace FallbackOrigin {
    export { type FallbackOriginUpdateResponse as FallbackOriginUpdateResponse, type FallbackOriginDeleteResponse as FallbackOriginDeleteResponse, type FallbackOriginGetResponse as FallbackOriginGetResponse, type FallbackOriginUpdateParams as FallbackOriginUpdateParams, type FallbackOriginDeleteParams as FallbackOriginDeleteParams, type FallbackOriginGetParams as FallbackOriginGetParams, };
}
//# sourceMappingURL=fallback-origin.d.ts.map