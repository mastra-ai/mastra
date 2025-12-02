// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class TieredCaching extends APIResource {
  /**
   * Tiered Cache works by dividing Cloudflare's data centers into a hierarchy of
   * lower-tiers and upper-tiers. If content is not cached in lower-tier data centers
   * (generally the ones closest to a visitor), the lower-tier must ask an upper-tier
   * to see if it has the content. If the upper-tier does not have the content, only
   * the upper-tier can ask the origin for content. This practice improves bandwidth
   * efficiency by limiting the number of data centers that can ask the origin for
   * content, which reduces origin load and makes websites more cost-effective to
   * operate. Additionally, Tiered Cache concentrates connections to origin servers
   * so they come from a small number of data centers rather than the full set of
   * network locations. This results in fewer open connections using server
   * resources.
   *
   * @example
   * ```ts
   * const response = await client.argo.tieredCaching.edit({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   value: 'on',
   * });
   * ```
   */
  edit(
    params: TieredCachingEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TieredCachingEditResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.patch(`/zones/${zone_id}/argo/tiered_caching`, { body, ...options }) as Core.APIPromise<{
        result: TieredCachingEditResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Tiered Cache works by dividing Cloudflare's data centers into a hierarchy of
   * lower-tiers and upper-tiers. If content is not cached in lower-tier data centers
   * (generally the ones closest to a visitor), the lower-tier must ask an upper-tier
   * to see if it has the content. If the upper-tier does not have the content, only
   * the upper-tier can ask the origin for content. This practice improves bandwidth
   * efficiency by limiting the number of data centers that can ask the origin for
   * content, which reduces origin load and makes websites more cost-effective to
   * operate. Additionally, Tiered Cache concentrates connections to origin servers
   * so they come from a small number of data centers rather than the full set of
   * network locations. This results in fewer open connections using server
   * resources.
   *
   * @example
   * ```ts
   * const tieredCaching = await client.argo.tieredCaching.get({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(
    params: TieredCachingGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TieredCachingGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/argo/tiered_caching`, options) as Core.APIPromise<{
        result: TieredCachingGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface TieredCachingEditResponse {
  /**
   * ID of the zone setting.
   */
  id: 'tiered_caching';

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

export interface TieredCachingGetResponse {
  /**
   * ID of the zone setting.
   */
  id: 'tiered_caching';

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

export interface TieredCachingEditParams {
  /**
   * Path param: Identifier
   */
  zone_id: string;

  /**
   * Body param: Enables Tiered Caching.
   */
  value: 'on' | 'off';
}

export interface TieredCachingGetParams {
  /**
   * Identifier
   */
  zone_id: string;
}

export declare namespace TieredCaching {
  export {
    type TieredCachingEditResponse as TieredCachingEditResponse,
    type TieredCachingGetResponse as TieredCachingGetResponse,
    type TieredCachingEditParams as TieredCachingEditParams,
    type TieredCachingGetParams as TieredCachingGetParams,
  };
}
