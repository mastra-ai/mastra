"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cache = void 0;
const resource_1 = require("../../resource.js");
const CacheReserveAPI = __importStar(require("./cache-reserve.js"));
const cache_reserve_1 = require("./cache-reserve.js");
const RegionalTieredCacheAPI = __importStar(require("./regional-tiered-cache.js"));
const regional_tiered_cache_1 = require("./regional-tiered-cache.js");
const SmartTieredCacheAPI = __importStar(require("./smart-tiered-cache.js"));
const smart_tiered_cache_1 = require("./smart-tiered-cache.js");
const VariantsAPI = __importStar(require("./variants.js"));
const variants_1 = require("./variants.js");
class Cache extends resource_1.APIResource {
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
exports.Cache = Cache;
Cache.CacheReserveResource = cache_reserve_1.CacheReserveResource;
Cache.SmartTieredCache = smart_tiered_cache_1.SmartTieredCache;
Cache.Variants = variants_1.Variants;
Cache.RegionalTieredCacheResource = regional_tiered_cache_1.RegionalTieredCacheResource;
//# sourceMappingURL=cache.js.map