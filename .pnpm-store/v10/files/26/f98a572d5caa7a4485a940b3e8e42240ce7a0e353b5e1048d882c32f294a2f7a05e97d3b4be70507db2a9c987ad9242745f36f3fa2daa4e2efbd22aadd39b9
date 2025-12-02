// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as CacheReserveAPI from "./cache-reserve.mjs";
import { CacheReserveResource, } from "./cache-reserve.mjs";
import * as RegionalTieredCacheAPI from "./regional-tiered-cache.mjs";
import { RegionalTieredCacheResource, } from "./regional-tiered-cache.mjs";
import * as SmartTieredCacheAPI from "./smart-tiered-cache.mjs";
import { SmartTieredCache, } from "./smart-tiered-cache.mjs";
import * as VariantsAPI from "./variants.mjs";
import { Variants, } from "./variants.mjs";
export class Cache extends APIResource {
    constructor() {
        super(...arguments);
        this.cacheReserve = new CacheReserveAPI.CacheReserveResource(this._client);
        this.smartTieredCache = new SmartTieredCacheAPI.SmartTieredCache(this._client);
        this.variants = new VariantsAPI.Variants(this._client);
        this.regionalTieredCache = new RegionalTieredCacheAPI.RegionalTieredCacheResource(this._client);
    }
    /**
     * ### Purge All Cached Content
     *
     * Removes ALL files from Cloudflare's cache. All tiers can purge everything.
     *
     * ```
     * {"purge_everything": true}
     * ```
     *
     * ### Purge Cached Content by URL
     *
     * Granularly removes one or more files from Cloudflare's cache by specifying URLs.
     * All tiers can purge by URL.
     *
     * To purge files with custom cache keys, include the headers used to compute the
     * cache key as in the example. If you have a device type or geo in your cache key,
     * you will need to include the CF-Device-Type or CF-IPCountry headers. If you have
     * lang in your cache key, you will need to include the Accept-Language header.
     *
     * **NB:** When including the Origin header, be sure to include the **scheme** and
     * **hostname**. The port number can be omitted if it is the default port (80 for
     * http, 443 for https), but must be included otherwise.
     *
     * Single file purge example with files:
     *
     * ```
     * {"files": ["http://www.example.com/css/styles.css", "http://www.example.com/js/index.js"]}
     * ```
     *
     * Single file purge example with url and header pairs:
     *
     * ```
     * {"files": [{url: "http://www.example.com/cat_picture.jpg", headers: { "CF-IPCountry": "US", "CF-Device-Type": "desktop", "Accept-Language": "zh-CN" }}, {url: "http://www.example.com/dog_picture.jpg", headers: { "CF-IPCountry": "EU", "CF-Device-Type": "mobile", "Accept-Language": "en-US" }}]}
     * ```
     *
     * ### Purge Cached Content by Tag, Host or Prefix
     *
     * Granularly removes one or more files from Cloudflare's cache either by
     * specifying the host, the associated Cache-Tag, or a Prefix.
     *
     * Flex purge with tags:
     *
     * ```
     * {"tags": ["a-cache-tag", "another-cache-tag"]}
     * ```
     *
     * Flex purge with hosts:
     *
     * ```
     * {"hosts": ["www.example.com", "images.example.com"]}
     * ```
     *
     * Flex purge with prefixes:
     *
     * ```
     * {"prefixes": ["www.example.com/foo", "images.example.com/bar/baz"]}
     * ```
     *
     * ### Availability and limits
     *
     * please refer to
     * [purge cache availability and limits documentation page](https://developers.cloudflare.com/cache/how-to/purge-cache/#availability-and-limits).
     *
     * @example
     * ```ts
     * const response = await client.cache.purge({
     *   zone_id: 'zone_id',
     * });
     * ```
     */
    purge(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/purge_cache`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
}
Cache.CacheReserveResource = CacheReserveResource;
Cache.SmartTieredCache = SmartTieredCache;
Cache.Variants = Variants;
Cache.RegionalTieredCacheResource = RegionalTieredCacheResource;
//# sourceMappingURL=cache.mjs.map