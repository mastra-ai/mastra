import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class RegionalTieredCacheResource extends APIResource {
    /**
     * Instructs Cloudflare to check a regional hub data center on the way to your
     * upper tier. This can help improve performance for smart and custom tiered cache
     * topologies.
     *
     * @example
     * ```ts
     * const response =
     *   await client.cache.regionalTieredCache.edit({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     value: 'on',
     *   });
     * ```
     */
    edit(params: RegionalTieredCacheEditParams, options?: Core.RequestOptions): Core.APIPromise<RegionalTieredCacheEditResponse>;
    /**
     * Instructs Cloudflare to check a regional hub data center on the way to your
     * upper tier. This can help improve performance for smart and custom tiered cache
     * topologies.
     *
     * @example
     * ```ts
     * const regionalTieredCache =
     *   await client.cache.regionalTieredCache.get({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params: RegionalTieredCacheGetParams, options?: Core.RequestOptions): Core.APIPromise<RegionalTieredCacheGetResponse>;
}
/**
 * ID of the zone setting.
 */
export type RegionalTieredCache = 'tc_regional';
export interface RegionalTieredCacheEditResponse {
    /**
     * ID of the zone setting.
     */
    id: RegionalTieredCache;
    /**
     * Whether the setting is editable
     */
    editable: boolean;
    /**
     * The value of the feature
     */
    value: 'on' | 'off';
    /**
     * Last time this setting was modified.
     */
    modified_on?: string | null;
}
export interface RegionalTieredCacheGetResponse {
    /**
     * ID of the zone setting.
     */
    id: RegionalTieredCache;
    /**
     * Whether the setting is editable
     */
    editable: boolean;
    /**
     * The value of the feature
     */
    value: 'on' | 'off';
    /**
     * Last time this setting was modified.
     */
    modified_on?: string | null;
}
export interface RegionalTieredCacheEditParams {
    /**
     * Path param: Identifier
     */
    zone_id: string;
    /**
     * Body param: Value of the Regional Tiered Cache zone setting.
     */
    value: 'on' | 'off';
}
export interface RegionalTieredCacheGetParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export declare namespace RegionalTieredCacheResource {
    export { type RegionalTieredCache as RegionalTieredCache, type RegionalTieredCacheEditResponse as RegionalTieredCacheEditResponse, type RegionalTieredCacheGetResponse as RegionalTieredCacheGetResponse, type RegionalTieredCacheEditParams as RegionalTieredCacheEditParams, type RegionalTieredCacheGetParams as RegionalTieredCacheGetParams, };
}
//# sourceMappingURL=regional-tiered-cache.d.ts.map