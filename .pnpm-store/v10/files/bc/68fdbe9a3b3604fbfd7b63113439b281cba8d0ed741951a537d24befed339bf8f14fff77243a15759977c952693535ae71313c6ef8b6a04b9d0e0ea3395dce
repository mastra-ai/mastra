// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class FallbackOrigin extends APIResource {
  /**
   * Update Fallback Origin for Custom Hostnames
   *
   * @example
   * ```ts
   * const fallbackOrigin =
   *   await client.customHostnames.fallbackOrigin.update({
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     origin: 'fallback.example.com',
   *   });
   * ```
   */
  update(
    params: FallbackOriginUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<FallbackOriginUpdateResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.put(`/zones/${zone_id}/custom_hostnames/fallback_origin`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: FallbackOriginUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Delete Fallback Origin for Custom Hostnames
   *
   * @example
   * ```ts
   * const fallbackOrigin =
   *   await client.customHostnames.fallbackOrigin.delete({
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  delete(
    params: FallbackOriginDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<FallbackOriginDeleteResponse> {
    const { zone_id } = params;
    return (
      this._client.delete(`/zones/${zone_id}/custom_hostnames/fallback_origin`, options) as Core.APIPromise<{
        result: FallbackOriginDeleteResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get Fallback Origin for Custom Hostnames
   *
   * @example
   * ```ts
   * const fallbackOrigin =
   *   await client.customHostnames.fallbackOrigin.get({
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  get(
    params: FallbackOriginGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<FallbackOriginGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/custom_hostnames/fallback_origin`, options) as Core.APIPromise<{
        result: FallbackOriginGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface FallbackOriginUpdateResponse {
  /**
   * This is the time the fallback origin was created.
   */
  created_at?: string;

  /**
   * These are errors that were encountered while trying to activate a fallback
   * origin.
   */
  errors?: Array<string>;

  /**
   * Your origin hostname that requests to your custom hostnames will be sent to.
   */
  origin?: string;

  /**
   * Status of the fallback origin's activation.
   */
  status?:
    | 'initializing'
    | 'pending_deployment'
    | 'pending_deletion'
    | 'active'
    | 'deployment_timed_out'
    | 'deletion_timed_out';

  /**
   * This is the time the fallback origin was updated.
   */
  updated_at?: string;
}

export interface FallbackOriginDeleteResponse {
  /**
   * This is the time the fallback origin was created.
   */
  created_at?: string;

  /**
   * These are errors that were encountered while trying to activate a fallback
   * origin.
   */
  errors?: Array<string>;

  /**
   * Your origin hostname that requests to your custom hostnames will be sent to.
   */
  origin?: string;

  /**
   * Status of the fallback origin's activation.
   */
  status?:
    | 'initializing'
    | 'pending_deployment'
    | 'pending_deletion'
    | 'active'
    | 'deployment_timed_out'
    | 'deletion_timed_out';

  /**
   * This is the time the fallback origin was updated.
   */
  updated_at?: string;
}

export interface FallbackOriginGetResponse {
  /**
   * This is the time the fallback origin was created.
   */
  created_at?: string;

  /**
   * These are errors that were encountered while trying to activate a fallback
   * origin.
   */
  errors?: Array<string>;

  /**
   * Your origin hostname that requests to your custom hostnames will be sent to.
   */
  origin?: string;

  /**
   * Status of the fallback origin's activation.
   */
  status?:
    | 'initializing'
    | 'pending_deployment'
    | 'pending_deletion'
    | 'active'
    | 'deployment_timed_out'
    | 'deletion_timed_out';

  /**
   * This is the time the fallback origin was updated.
   */
  updated_at?: string;
}

export interface FallbackOriginUpdateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: Your origin hostname that requests to your custom hostnames will be
   * sent to.
   */
  origin: string;
}

export interface FallbackOriginDeleteParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export interface FallbackOriginGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export declare namespace FallbackOrigin {
  export {
    type FallbackOriginUpdateResponse as FallbackOriginUpdateResponse,
    type FallbackOriginDeleteResponse as FallbackOriginDeleteResponse,
    type FallbackOriginGetResponse as FallbackOriginGetResponse,
    type FallbackOriginUpdateParams as FallbackOriginUpdateParams,
    type FallbackOriginDeleteParams as FallbackOriginDeleteParams,
    type FallbackOriginGetParams as FallbackOriginGetParams,
  };
}
