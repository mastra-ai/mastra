// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

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
  delete(
    params: SmartTieredCacheDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SmartTieredCacheDeleteResponse> {
    const { zone_id } = params;
    return (
      this._client.delete(
        `/zones/${zone_id}/cache/tiered_cache_smart_topology_enable`,
        options,
      ) as Core.APIPromise<{ result: SmartTieredCacheDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
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
  edit(
    params: SmartTieredCacheEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SmartTieredCacheEditResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.patch(`/zones/${zone_id}/cache/tiered_cache_smart_topology_enable`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: SmartTieredCacheEditResponse }>
    )._thenUnwrap((obj) => obj.result);
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
  get(
    params: SmartTieredCacheGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SmartTieredCacheGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(
        `/zones/${zone_id}/cache/tiered_cache_smart_topology_enable`,
        options,
      ) as Core.APIPromise<{ result: SmartTieredCacheGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface SmartTieredCacheDeleteResponse {
  /**
   * ID of the zone setting.
   */
  id: 'tiered_cache_smart_topology_enable';

  /**
   * Whether the setting is editable
   */
  editable: boolean;

  /**
   * Last time this setting was modified.
   */
  modified_on?: string | null;
}

export interface SmartTieredCacheEditResponse {
  /**
   * ID of the zone setting.
   */
  id: 'tiered_cache_smart_topology_enable';

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

export interface SmartTieredCacheGetResponse {
  /**
   * ID of the zone setting.
   */
  id: 'tiered_cache_smart_topology_enable';

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

export interface SmartTieredCacheDeleteParams {
  /**
   * Identifier
   */
  zone_id: string;
}

export interface SmartTieredCacheEditParams {
  /**
   * Path param: Identifier
   */
  zone_id: string;

  /**
   * Body param: Enable or disable the Smart Tiered Cache
   */
  value: 'on' | 'off';
}

export interface SmartTieredCacheGetParams {
  /**
   * Identifier
   */
  zone_id: string;
}

export declare namespace SmartTieredCache {
  export {
    type SmartTieredCacheDeleteResponse as SmartTieredCacheDeleteResponse,
    type SmartTieredCacheEditResponse as SmartTieredCacheEditResponse,
    type SmartTieredCacheGetResponse as SmartTieredCacheGetResponse,
    type SmartTieredCacheDeleteParams as SmartTieredCacheDeleteParams,
    type SmartTieredCacheEditParams as SmartTieredCacheEditParams,
    type SmartTieredCacheGetParams as SmartTieredCacheGetParams,
  };
}
