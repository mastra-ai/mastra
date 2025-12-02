// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Retention extends APIResource {
  /**
   * Updates log retention flag for Logpull API.
   *
   * @example
   * ```ts
   * const retention =
   *   await client.logs.control.retention.create({
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  create(
    params: RetentionCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RetentionCreateResponse | null> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/logs/control/retention/flag`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: RetentionCreateResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Gets log retention flag for Logpull API.
   *
   * @example
   * ```ts
   * const retention = await client.logs.control.retention.get({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(
    params: RetentionGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RetentionGetResponse | null> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/logs/control/retention/flag`, options) as Core.APIPromise<{
        result: RetentionGetResponse | null;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface RetentionCreateResponse {
  /**
   * The log retention flag for Logpull API.
   */
  flag?: boolean;
}

export interface RetentionGetResponse {
  /**
   * The log retention flag for Logpull API.
   */
  flag?: boolean;
}

export interface RetentionCreateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: The log retention flag for Logpull API.
   */
  flag?: boolean;
}

export interface RetentionGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export declare namespace Retention {
  export {
    type RetentionCreateResponse as RetentionCreateResponse,
    type RetentionGetResponse as RetentionGetResponse,
    type RetentionCreateParams as RetentionCreateParams,
    type RetentionGetParams as RetentionGetParams,
  };
}
