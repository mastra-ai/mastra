// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class SmartRouting extends APIResource {
  /**
   * Updates enablement of Argo Smart Routing.
   *
   * @example
   * ```ts
   * const response = await client.argo.smartRouting.edit({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   value: 'on',
   * });
   * ```
   */
  edit(
    params: SmartRoutingEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SmartRoutingEditResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.patch(`/zones/${zone_id}/argo/smart_routing`, { body, ...options }) as Core.APIPromise<{
        result: SmartRoutingEditResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get Argo Smart Routing setting
   *
   * @example
   * ```ts
   * const smartRouting = await client.argo.smartRouting.get({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(
    params: SmartRoutingGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SmartRoutingGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/argo/smart_routing`, options) as Core.APIPromise<{
        result: SmartRoutingGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export type SmartRoutingEditResponse = unknown | string | null;

export type SmartRoutingGetResponse = unknown | string | null;

export interface SmartRoutingEditParams {
  /**
   * Path param: Identifier
   */
  zone_id: string;

  /**
   * Body param: Enables Argo Smart Routing.
   */
  value: 'on' | 'off';
}

export interface SmartRoutingGetParams {
  /**
   * Identifier
   */
  zone_id: string;
}

export declare namespace SmartRouting {
  export {
    type SmartRoutingEditResponse as SmartRoutingEditResponse,
    type SmartRoutingGetResponse as SmartRoutingGetResponse,
    type SmartRoutingEditParams as SmartRoutingEditParams,
    type SmartRoutingGetParams as SmartRoutingGetParams,
  };
}
