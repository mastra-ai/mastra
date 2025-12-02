"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheReserveResource = void 0;
const resource_1 = require("../../resource.js");
class CacheReserveResource extends resource_1.APIResource {
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
    clear(params, options) {
        const { zone_id, body } = params;
        return this._client.post(`/zones/${zone_id}/cache/cache_reserve_clear`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
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
    edit(params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/cache/cache_reserve`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
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
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/cache/cache_reserve`, options)._thenUnwrap((obj) => obj.result);
    }
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
    status(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/cache/cache_reserve_clear`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.CacheReserveResource = CacheReserveResource;
//# sourceMappingURL=cache-reserve.js.map