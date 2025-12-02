// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as CacheReserveAPI from './cache-reserve';
import {
  CacheReserve,
  CacheReserveClear,
  CacheReserveClearParams,
  CacheReserveClearResponse,
  CacheReserveEditParams,
  CacheReserveEditResponse,
  CacheReserveGetParams,
  CacheReserveGetResponse,
  CacheReserveResource,
  CacheReserveStatusParams,
  CacheReserveStatusResponse,
  State,
} from './cache-reserve';
import * as RegionalTieredCacheAPI from './regional-tiered-cache';
import {
  RegionalTieredCache,
  RegionalTieredCacheEditParams,
  RegionalTieredCacheEditResponse,
  RegionalTieredCacheGetParams,
  RegionalTieredCacheGetResponse,
  RegionalTieredCacheResource,
} from './regional-tiered-cache';
import * as SmartTieredCacheAPI from './smart-tiered-cache';
import {
  SmartTieredCache,
  SmartTieredCacheDeleteParams,
  SmartTieredCacheDeleteResponse,
  SmartTieredCacheEditParams,
  SmartTieredCacheEditResponse,
  SmartTieredCacheGetParams,
  SmartTieredCacheGetResponse,
} from './smart-tiered-cache';
import * as VariantsAPI from './variants';
import {
  CacheVariant,
  VariantDeleteParams,
  VariantDeleteResponse,
  VariantEditParams,
  VariantEditResponse,
  VariantGetParams,
  VariantGetResponse,
  Variants,
} from './variants';

export class Cache extends APIResource {
  cacheReserve: CacheReserveAPI.CacheReserveResource = new CacheReserveAPI.CacheReserveResource(this._client);
  smartTieredCache: SmartTieredCacheAPI.SmartTieredCache = new SmartTieredCacheAPI.SmartTieredCache(
    this._client,
  );
  variants: VariantsAPI.Variants = new VariantsAPI.Variants(this._client);
  regionalTieredCache: RegionalTieredCacheAPI.RegionalTieredCacheResource =
    new RegionalTieredCacheAPI.RegionalTieredCacheResource(this._client);

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
  purge(params: CachePurgeParams, options?: Core.RequestOptions): Core.APIPromise<CachePurgeResponse | null> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/purge_cache`, { body, ...options }) as Core.APIPromise<{
        result: CachePurgeResponse | null;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface CachePurgeResponse {
  /**
   * Identifier.
   */
  id: string;
}

export type CachePurgeParams =
  | CachePurgeParams.CachePurgeFlexPurgeByTags
  | CachePurgeParams.CachePurgeFlexPurgeByHostnames
  | CachePurgeParams.CachePurgeFlexPurgeByPrefixes
  | CachePurgeParams.CachePurgeEverything
  | CachePurgeParams.CachePurgeSingleFile
  | CachePurgeParams.CachePurgeSingleFileWithURLAndHeaders;

export declare namespace CachePurgeParams {
  export interface CachePurgeFlexPurgeByTags {
    /**
     * Path param:
     */
    zone_id: string;

    /**
     * Body param: For more information on cache tags and purging by tags, please refer
     * to
     * [purge by cache-tags documentation page](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/).
     */
    tags?: Array<string>;
  }

  export interface CachePurgeFlexPurgeByHostnames {
    /**
     * Path param:
     */
    zone_id: string;

    /**
     * Body param: For more information purging by hostnames, please refer to
     * [purge by hostname documentation page](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-hostname/).
     */
    hosts?: Array<string>;
  }

  export interface CachePurgeFlexPurgeByPrefixes {
    /**
     * Path param:
     */
    zone_id: string;

    /**
     * Body param: For more information on purging by prefixes, please refer to
     * [purge by prefix documentation page](https://developers.cloudflare.com/cache/how-to/purge-cache/purge_by_prefix/).
     */
    prefixes?: Array<string>;
  }

  export interface CachePurgeEverything {
    /**
     * Path param:
     */
    zone_id: string;

    /**
     * Body param: For more information, please refer to
     * [purge everything documentation page](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-everything/).
     */
    purge_everything?: boolean;
  }

  export interface CachePurgeSingleFile {
    /**
     * Path param:
     */
    zone_id: string;

    /**
     * Body param: For more information on purging files, please refer to
     * [purge by single-file documentation page](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-single-file/).
     */
    files?: Array<string>;
  }

  export interface CachePurgeSingleFileWithURLAndHeaders {
    /**
     * Path param:
     */
    zone_id: string;

    /**
     * Body param: For more information on purging files with URL and headers, please
     * refer to
     * [purge by single-file documentation page](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-single-file/).
     */
    files?: Array<CachePurgeSingleFileWithURLAndHeaders.File>;
  }

  export namespace CachePurgeSingleFileWithURLAndHeaders {
    export interface File {
      headers?: { [key: string]: string };

      url?: string;
    }
  }
}

Cache.CacheReserveResource = CacheReserveResource;
Cache.SmartTieredCache = SmartTieredCache;
Cache.Variants = Variants;
Cache.RegionalTieredCacheResource = RegionalTieredCacheResource;

export declare namespace Cache {
  export { type CachePurgeResponse as CachePurgeResponse, type CachePurgeParams as CachePurgeParams };

  export {
    CacheReserveResource as CacheReserveResource,
    type CacheReserve as CacheReserve,
    type CacheReserveClear as CacheReserveClear,
    type State as State,
    type CacheReserveClearResponse as CacheReserveClearResponse,
    type CacheReserveEditResponse as CacheReserveEditResponse,
    type CacheReserveGetResponse as CacheReserveGetResponse,
    type CacheReserveStatusResponse as CacheReserveStatusResponse,
    type CacheReserveClearParams as CacheReserveClearParams,
    type CacheReserveEditParams as CacheReserveEditParams,
    type CacheReserveGetParams as CacheReserveGetParams,
    type CacheReserveStatusParams as CacheReserveStatusParams,
  };

  export {
    SmartTieredCache as SmartTieredCache,
    type SmartTieredCacheDeleteResponse as SmartTieredCacheDeleteResponse,
    type SmartTieredCacheEditResponse as SmartTieredCacheEditResponse,
    type SmartTieredCacheGetResponse as SmartTieredCacheGetResponse,
    type SmartTieredCacheDeleteParams as SmartTieredCacheDeleteParams,
    type SmartTieredCacheEditParams as SmartTieredCacheEditParams,
    type SmartTieredCacheGetParams as SmartTieredCacheGetParams,
  };

  export {
    Variants as Variants,
    type CacheVariant as CacheVariant,
    type VariantDeleteResponse as VariantDeleteResponse,
    type VariantEditResponse as VariantEditResponse,
    type VariantGetResponse as VariantGetResponse,
    type VariantDeleteParams as VariantDeleteParams,
    type VariantEditParams as VariantEditParams,
    type VariantGetParams as VariantGetParams,
  };

  export {
    RegionalTieredCacheResource as RegionalTieredCacheResource,
    type RegionalTieredCache as RegionalTieredCache,
    type RegionalTieredCacheEditResponse as RegionalTieredCacheEditResponse,
    type RegionalTieredCacheGetResponse as RegionalTieredCacheGetResponse,
    type RegionalTieredCacheEditParams as RegionalTieredCacheEditParams,
    type RegionalTieredCacheGetParams as RegionalTieredCacheGetParams,
  };
}
