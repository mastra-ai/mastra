// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Keys extends APIResource {
  /**
   * Create a new signing key with specified name. Returns all keys available.
   *
   * @example
   * ```ts
   * const key = await client.images.v1.keys.update('someKey', {
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  update(
    signingKeyName: string,
    params: KeyUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<KeyUpdateResponse> {
    const { account_id } = params;
    return (
      this._client.put(
        `/accounts/${account_id}/images/v1/keys/${signingKeyName}`,
        options,
      ) as Core.APIPromise<{ result: KeyUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists your signing keys. These can be found on your Cloudflare Images dashboard.
   *
   * @example
   * ```ts
   * const keys = await client.images.v1.keys.list({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  list(params: KeyListParams, options?: Core.RequestOptions): Core.APIPromise<KeyListResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/images/v1/keys`, options) as Core.APIPromise<{
        result: KeyListResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Delete signing key with specified name. Returns all keys available. When last
   * key is removed, a new default signing key will be generated.
   *
   * @example
   * ```ts
   * const key = await client.images.v1.keys.delete('someKey', {
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  delete(
    signingKeyName: string,
    params: KeyDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<KeyDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/images/v1/keys/${signingKeyName}`,
        options,
      ) as Core.APIPromise<{ result: KeyDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface Key {
  /**
   * Key name.
   */
  name?: string;

  /**
   * Key value.
   */
  value?: string;
}

export interface KeyUpdateResponse {
  keys?: Array<Key>;
}

export interface KeyListResponse {
  keys?: Array<Key>;
}

export interface KeyDeleteResponse {
  keys?: Array<Key>;
}

export interface KeyUpdateParams {
  /**
   * Account identifier tag.
   */
  account_id: string;
}

export interface KeyListParams {
  /**
   * Account identifier tag.
   */
  account_id: string;
}

export interface KeyDeleteParams {
  /**
   * Account identifier tag.
   */
  account_id: string;
}

export declare namespace Keys {
  export {
    type Key as Key,
    type KeyUpdateResponse as KeyUpdateResponse,
    type KeyListResponse as KeyListResponse,
    type KeyDeleteResponse as KeyDeleteResponse,
    type KeyUpdateParams as KeyUpdateParams,
    type KeyListParams as KeyListParams,
    type KeyDeleteParams as KeyDeleteParams,
  };
}
