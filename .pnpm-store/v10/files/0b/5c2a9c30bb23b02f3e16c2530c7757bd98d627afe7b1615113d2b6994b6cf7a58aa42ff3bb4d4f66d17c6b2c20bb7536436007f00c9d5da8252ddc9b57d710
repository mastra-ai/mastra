// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../resource';
import * as Core from '../core';

export class URLNormalization extends APIResource {
  /**
   * Updates the URL Normalization settings.
   *
   * @example
   * ```ts
   * const urlNormalization =
   *   await client.urlNormalization.update({
   *     zone_id: '9f1839b6152d298aca64c4e906b6d074',
   *     scope: 'incoming',
   *     type: 'cloudflare',
   *   });
   * ```
   */
  update(
    params: URLNormalizationUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<URLNormalizationUpdateResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.put(`/zones/${zone_id}/url_normalization`, { body, ...options }) as Core.APIPromise<{
        result: URLNormalizationUpdateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Deletes the URL Normalization settings.
   *
   * @example
   * ```ts
   * await client.urlNormalization.delete({
   *   zone_id: '9f1839b6152d298aca64c4e906b6d074',
   * });
   * ```
   */
  delete(params: URLNormalizationDeleteParams, options?: Core.RequestOptions): Core.APIPromise<void> {
    const { zone_id } = params;
    return this._client.delete(`/zones/${zone_id}/url_normalization`, {
      ...options,
      headers: { Accept: '*/*', ...options?.headers },
    });
  }

  /**
   * Fetches the current URL Normalization settings.
   *
   * @example
   * ```ts
   * const urlNormalization = await client.urlNormalization.get({
   *   zone_id: '9f1839b6152d298aca64c4e906b6d074',
   * });
   * ```
   */
  get(
    params: URLNormalizationGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<URLNormalizationGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/url_normalization`, options) as Core.APIPromise<{
        result: URLNormalizationGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * A result.
 */
export interface URLNormalizationUpdateResponse {
  /**
   * The scope of the URL normalization.
   */
  scope: 'incoming' | 'both';

  /**
   * The type of URL normalization performed by Cloudflare.
   */
  type: 'cloudflare' | 'rfc3986';
}

/**
 * A result.
 */
export interface URLNormalizationGetResponse {
  /**
   * The scope of the URL normalization.
   */
  scope: 'incoming' | 'both';

  /**
   * The type of URL normalization performed by Cloudflare.
   */
  type: 'cloudflare' | 'rfc3986';
}

export interface URLNormalizationUpdateParams {
  /**
   * Path param: The unique ID of the zone.
   */
  zone_id: string;

  /**
   * Body param: The scope of the URL normalization.
   */
  scope: 'incoming' | 'both';

  /**
   * Body param: The type of URL normalization performed by Cloudflare.
   */
  type: 'cloudflare' | 'rfc3986';
}

export interface URLNormalizationDeleteParams {
  /**
   * The unique ID of the zone.
   */
  zone_id: string;
}

export interface URLNormalizationGetParams {
  /**
   * The unique ID of the zone.
   */
  zone_id: string;
}

export declare namespace URLNormalization {
  export {
    type URLNormalizationUpdateResponse as URLNormalizationUpdateResponse,
    type URLNormalizationGetResponse as URLNormalizationGetResponse,
    type URLNormalizationUpdateParams as URLNormalizationUpdateParams,
    type URLNormalizationDeleteParams as URLNormalizationDeleteParams,
    type URLNormalizationGetParams as URLNormalizationGetParams,
  };
}
