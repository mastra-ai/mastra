// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class RegionalTieredCacheResource extends APIResource {
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
  edit(
    params: RegionalTieredCacheEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RegionalTieredCacheEditResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.patch(`/zones/${zone_id}/cache/regional_tiered_cache`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: RegionalTieredCacheEditResponse }>
    )._thenUnwrap((obj) => obj.result);
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
  get(
    params: RegionalTieredCacheGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RegionalTieredCacheGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/cache/regional_tiered_cache`, options) as Core.APIPromise<{
        result: RegionalTieredCacheGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
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
  export {
    type RegionalTieredCache as RegionalTieredCache,
    type RegionalTieredCacheEditResponse as RegionalTieredCacheEditResponse,
    type RegionalTieredCacheGetResponse as RegionalTieredCacheGetResponse,
    type RegionalTieredCacheEditParams as RegionalTieredCacheEditParams,
    type RegionalTieredCacheGetParams as RegionalTieredCacheGetParams,
  };
}
