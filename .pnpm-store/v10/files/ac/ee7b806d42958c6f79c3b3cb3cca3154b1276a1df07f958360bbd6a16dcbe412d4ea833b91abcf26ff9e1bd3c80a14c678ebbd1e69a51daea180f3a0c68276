import { APIResource } from "../resource.js";
import * as Core from "../core.js";
export declare class URLNormalization extends APIResource {
    /**
     * Updates the URL Normalization settings.
     *
     * @example
     * ```ts
     * const urlNormalization =
     *   await client.urlNormalization.update({
     *     zone_id: '9f1839b6152d298aca64c4e906b6d074',
     *     scope: 'incoming',
     *     type: 'cloudflare',
     *   });
     * ```
     */
    update(params: URLNormalizationUpdateParams, options?: Core.RequestOptions): Core.APIPromise<URLNormalizationUpdateResponse>;
    /**
     * Deletes the URL Normalization settings.
     *
     * @example
     * ```ts
     * await client.urlNormalization.delete({
     *   zone_id: '9f1839b6152d298aca64c4e906b6d074',
     * });
     * ```
     */
    delete(params: URLNormalizationDeleteParams, options?: Core.RequestOptions): Core.APIPromise<void>;
    /**
     * Fetches the current URL Normalization settings.
     *
     * @example
     * ```ts
     * const urlNormalization = await client.urlNormalization.get({
     *   zone_id: '9f1839b6152d298aca64c4e906b6d074',
     * });
     * ```
     */
    get(params: URLNormalizationGetParams, options?: Core.RequestOptions): Core.APIPromise<URLNormalizationGetResponse>;
}
/**
 * A result.
 */
export interface URLNormalizationUpdateResponse {
    /**
     * The scope of the URL normalization.
     */
    scope: 'incoming' | 'both';
    /**
     * The type of URL normalization performed by Cloudflare.
     */
    type: 'cloudflare' | 'rfc3986';
}
/**
 * A result.
 */
export interface URLNormalizationGetResponse {
    /**
     * The scope of the URL normalization.
     */
    scope: 'incoming' | 'both';
    /**
     * The type of URL normalization performed by Cloudflare.
     */
    type: 'cloudflare' | 'rfc3986';
}
export interface URLNormalizationUpdateParams {
    /**
     * Path param: The unique ID of the zone.
     */
    zone_id: string;
    /**
     * Body param: The scope of the URL normalization.
     */
    scope: 'incoming' | 'both';
    /**
     * Body param: The type of URL normalization performed by Cloudflare.
     */
    type: 'cloudflare' | 'rfc3986';
}
export interface URLNormalizationDeleteParams {
    /**
     * The unique ID of the zone.
     */
    zone_id: string;
}
export interface URLNormalizationGetParams {
    /**
     * The unique ID of the zone.
     */
    zone_id: string;
}
export declare namespace URLNormalization {
    export { type URLNormalizationUpdateResponse as URLNormalizationUpdateResponse, type URLNormalizationGetResponse as URLNormalizationGetResponse, type URLNormalizationUpdateParams as URLNormalizationUpdateParams, type URLNormalizationDeleteParams as URLNormalizationDeleteParams, type URLNormalizationGetParams as URLNormalizationGetParams, };
}
//# sourceMappingURL=url-normalization.d.ts.map