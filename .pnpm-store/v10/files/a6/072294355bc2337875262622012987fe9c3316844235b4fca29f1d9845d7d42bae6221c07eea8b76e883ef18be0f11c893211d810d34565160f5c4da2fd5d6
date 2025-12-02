// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class SmartTieredCache extends APIResource {
    /**
     * Smart Tiered Cache dynamically selects the single closest upper tier for each of
     * your website’s origins with no configuration required, using our in-house
     * performance and routing data. Cloudflare collects latency data for each request
     * to an origin, and uses the latency data to determine how well any upper-tier
     * data center is connected with an origin. As a result, Cloudflare can select the
     * data center with the lowest latency to be the upper-tier for an origin.
     *
     * @example
     * ```ts
     * const smartTieredCache =
     *   await client.cache.smartTieredCache.delete({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    delete(params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/cache/tiered_cache_smart_topology_enable`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Smart Tiered Cache dynamically selects the single closest upper tier for each of
     * your website’s origins with no configuration required, using our in-house
     * performance and routing data. Cloudflare collects latency data for each request
     * to an origin, and uses the latency data to determine how well any upper-tier
     * data center is connected with an origin. As a result, Cloudflare can select the
     * data center with the lowest latency to be the upper-tier for an origin.
     *
     * @example
     * ```ts
     * const response = await client.cache.smartTieredCache.edit({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   value: 'on',
     * });
     * ```
     */
    edit(params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/cache/tiered_cache_smart_topology_enable`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Smart Tiered Cache dynamically selects the single closest upper tier for each of
     * your website’s origins with no configuration required, using our in-house
     * performance and routing data. Cloudflare collects latency data for each request
     * to an origin, and uses the latency data to determine how well any upper-tier
     * data center is connected with an origin. As a result, Cloudflare can select the
     * data center with the lowest latency to be the upper-tier for an origin.
     *
     * @example
     * ```ts
     * const smartTieredCache =
     *   await client.cache.smartTieredCache.get({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/cache/tiered_cache_smart_topology_enable`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=smart-tiered-cache.mjs.map