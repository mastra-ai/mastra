// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Keys extends APIResource {
  /**
   * Updates the Access key rotation settings for an account.
   *
   * @example
   * ```ts
   * const key = await client.zeroTrust.access.keys.update({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   key_rotation_interval_days: 30,
   * });
   * ```
   */
  update(params: KeyUpdateParams, options?: Core.RequestOptions): Core.APIPromise<KeyUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/access/keys`, { body, ...options }) as Core.APIPromise<{
        result: KeyUpdateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Gets the Access key rotation settings for an account.
   *
   * @example
   * ```ts
   * const key = await client.zeroTrust.access.keys.get({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(params: KeyGetParams, options?: Core.RequestOptions): Core.APIPromise<KeyGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/access/keys`, options) as Core.APIPromise<{
        result: KeyGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Perfoms a key rotation for an account.
   *
   * @example
   * ```ts
   * const response = await client.zeroTrust.access.keys.rotate({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  rotate(params: KeyRotateParams, options?: Core.RequestOptions): Core.APIPromise<KeyRotateResponse> {
    const { account_id } = params;
    return (
      this._client.post(`/accounts/${account_id}/access/keys/rotate`, options) as Core.APIPromise<{
        result: KeyRotateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface KeyUpdateResponse {
  /**
   * The number of days until the next key rotation.
   */
  days_until_next_rotation?: number;

  /**
   * The number of days between key rotations.
   */
  key_rotation_interval_days?: number;

  /**
   * The timestamp of the previous key rotation.
   */
  last_key_rotation_at?: string;
}

export interface KeyGetResponse {
  /**
   * The number of days until the next key rotation.
   */
  days_until_next_rotation?: number;

  /**
   * The number of days between key rotations.
   */
  key_rotation_interval_days?: number;

  /**
   * The timestamp of the previous key rotation.
   */
  last_key_rotation_at?: string;
}

export interface KeyRotateResponse {
  /**
   * The number of days until the next key rotation.
   */
  days_until_next_rotation?: number;

  /**
   * The number of days between key rotations.
   */
  key_rotation_interval_days?: number;

  /**
   * The timestamp of the previous key rotation.
   */
  last_key_rotation_at?: string;
}

export interface KeyUpdateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: The number of days between key rotations.
   */
  key_rotation_interval_days: number;
}

export interface KeyGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export interface KeyRotateParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export declare namespace Keys {
  export {
    type KeyUpdateResponse as KeyUpdateResponse,
    type KeyGetResponse as KeyGetResponse,
    type KeyRotateResponse as KeyRotateResponse,
    type KeyUpdateParams as KeyUpdateParams,
    type KeyGetParams as KeyGetParams,
    type KeyRotateParams as KeyRotateParams,
  };
}
