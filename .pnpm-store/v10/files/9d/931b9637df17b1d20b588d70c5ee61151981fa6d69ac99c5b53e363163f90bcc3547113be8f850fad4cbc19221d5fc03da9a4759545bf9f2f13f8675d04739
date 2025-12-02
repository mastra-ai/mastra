"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegionalTieredCacheResource = void 0;
const resource_1 = require("../../resource.js");
class RegionalTieredCacheResource extends resource_1.APIResource {
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
    edit(params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/cache/regional_tiered_cache`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
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
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/cache/regional_tiered_cache`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.RegionalTieredCacheResource = RegionalTieredCacheResource;
//# sourceMappingURL=regional-tiered-cache.js.map