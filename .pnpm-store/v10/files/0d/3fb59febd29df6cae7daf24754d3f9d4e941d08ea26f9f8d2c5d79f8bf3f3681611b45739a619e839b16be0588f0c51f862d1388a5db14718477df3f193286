import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class CacheReserveResource extends APIResource {
    /**
     * You can use Cache Reserve Clear to clear your Cache Reserve, but you must first
     * disable Cache Reserve. In most cases, this will be accomplished within 24 hours.
     * You cannot re-enable Cache Reserve while this process is ongoing. Keep in mind
     * that you cannot undo or cancel this operation.
     *
     * @example
     * ```ts
     * const response = await client.cache.cacheReserve.clear({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   body: {},
     * });
     * ```
     */
    clear(params: CacheReserveClearParams, options?: Core.RequestOptions): Core.APIPromise<CacheReserveClearResponse>;
    /**
     * Increase cache lifetimes by automatically storing all cacheable files into
     * Cloudflare's persistent object storage buckets. Requires Cache Reserve
     * subscription. Note: using Tiered Cache with Cache Reserve is highly recommended
     * to reduce Reserve operations costs. See the
     * [developer docs](https://developers.cloudflare.com/cache/about/cache-reserve)
     * for more information.
     *
     * @example
     * ```ts
     * const response = await client.cache.cacheReserve.edit({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   value: 'on',
     * });
     * ```
     */
    edit(params: CacheReserveEditParams, options?: Core.RequestOptions): Core.APIPromise<CacheReserveEditResponse>;
    /**
     * Increase cache lifetimes by automatically storing all cacheable files into
     * Cloudflare's persistent object storage buckets. Requires Cache Reserve
     * subscription. Note: using Tiered Cache with Cache Reserve is highly recommended
     * to reduce Reserve operations costs. See the
     * [developer docs](https://developers.cloudflare.com/cache/about/cache-reserve)
     * for more information.
     *
     * @example
     * ```ts
     * const cacheReserve = await client.cache.cacheReserve.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: CacheReserveGetParams, options?: Core.RequestOptions): Core.APIPromise<CacheReserveGetResponse>;
    /**
     * You can use Cache Reserve Clear to clear your Cache Reserve, but you must first
     * disable Cache Reserve. In most cases, this will be accomplished within 24 hours.
     * You cannot re-enable Cache Reserve while this process is ongoing. Keep in mind
     * that you cannot undo or cancel this operation.
     *
     * @example
     * ```ts
     * const response = await client.cache.cacheReserve.status({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    status(params: CacheReserveStatusParams, options?: Core.RequestOptions): Core.APIPromise<CacheReserveStatusResponse>;
}
/**
 * ID of the zone setting.
 */
export type CacheReserve = 'cache_reserve';
/**
 * ID of the zone setting.
 */
export type CacheReserveClear = 'cache_reserve_clear';
/**
 * The current state of the Cache Reserve Clear operation.
 */
export type State = 'In-progress' | 'Completed';
/**
 * You can use Cache Reserve Clear to clear your Cache Reserve, but you must first
 * disable Cache Reserve. In most cases, this will be accomplished within 24 hours.
 * You cannot re-enable Cache Reserve while this process is ongoing. Keep in mind
 * that you cannot undo or cancel this operation.
 */
export interface CacheReserveClearResponse {
    /**
     * ID of the zone setting.
     */
    id: CacheReserveClear;
    /**
     * The time that the latest Cache Reserve Clear operation started.
     */
    start_ts: string;
    /**
     * The current state of the Cache Reserve Clear operation.
     */
    state: State;
    /**
     * The time that the latest Cache Reserve Clear operation completed.
     */
    end_ts?: string;
    /**
     * Last time this setting was modified.
     */
    modified_on?: string | null;
}
export interface CacheReserveEditResponse {
    /**
     * ID of the zone setting.
     */
    id: CacheReserve;
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
export interface CacheReserveGetResponse {
    /**
     * ID of the zone setting.
     */
    id: CacheReserve;
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
/**
 * You can use Cache Reserve Clear to clear your Cache Reserve, but you must first
 * disable Cache Reserve. In most cases, this will be accomplished within 24 hours.
 * You cannot re-enable Cache Reserve while this process is ongoing. Keep in mind
 * that you cannot undo or cancel this operation.
 */
export interface CacheReserveStatusResponse {
    /**
     * ID of the zone setting.
     */
    id: CacheReserveClear;
    /**
     * The time that the latest Cache Reserve Clear operation started.
     */
    start_ts: string;
    /**
     * The current state of the Cache Reserve Clear operation.
     */
    state: State;
    /**
     * The time that the latest Cache Reserve Clear operation completed.
     */
    end_ts?: string;
    /**
     * Last time this setting was modified.
     */
    modified_on?: string | null;
}
export interface CacheReserveClearParams {
    /**
     * Path param: Identifier
     */
    zone_id: string;
    /**
     * Body param:
     */
    body: unknown;
}
export interface CacheReserveEditParams {
    /**
     * Path param: Identifier
     */
    zone_id: string;
    /**
     * Body param: Value of the Cache Reserve zone setting.
     */
    value: 'on' | 'off';
}
export interface CacheReserveGetParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export interface CacheReserveStatusParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export declare namespace CacheReserveResource {
    export { type CacheReserve as CacheReserve, type CacheReserveClear as CacheReserveClear, type State as State, type CacheReserveClearResponse as CacheReserveClearResponse, type CacheReserveEditResponse as CacheReserveEditResponse, type CacheReserveGetResponse as CacheReserveGetResponse, type CacheReserveStatusResponse as CacheReserveStatusResponse, type CacheReserveClearParams as CacheReserveClearParams, type CacheReserveEditParams as CacheReserveEditParams, type CacheReserveGetParams as CacheReserveGetParams, type CacheReserveStatusParams as CacheReserveStatusParams, };
}
//# sourceMappingURL=cache-reserve.d.ts.map