// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { SinglePage } from '../../pagination';

export class Keys extends APIResource {
  /**
   * Creates an RSA private key in PEM and JWK formats. Key files are only displayed
   * once after creation. Keys are created, used, and deleted independently of
   * videos, and every key can sign any video.
   *
   * @example
   * ```ts
   * const keys = await client.stream.keys.create({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   body: {},
   * });
   * ```
   */
  create(params: KeyCreateParams, options?: Core.RequestOptions): Core.APIPromise<Keys> {
    const { account_id, body } = params;
    return (
      this._client.post(`/accounts/${account_id}/stream/keys`, {
        body: body,
        ...options,
      }) as Core.APIPromise<{ result: Keys }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Deletes signing keys and revokes all signed URLs generated with the key.
   *
   * @example
   * ```ts
   * const key = await client.stream.keys.delete(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    identifier: string,
    params: KeyDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<KeyDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(`/accounts/${account_id}/stream/keys/${identifier}`, options) as Core.APIPromise<{
        result: KeyDeleteResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists the video ID and creation date and time when a signing key was created.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const keyGetResponse of client.stream.keys.get({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * })) {
   *   // ...
   * }
   * ```
   */
  get(
    params: KeyGetParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<KeyGetResponsesSinglePage, KeyGetResponse> {
    const { account_id } = params;
    return this._client.getAPIList(`/accounts/${account_id}/stream/keys`, KeyGetResponsesSinglePage, options);
  }
}

export class KeyGetResponsesSinglePage extends SinglePage<KeyGetResponse> {}

export interface Keys {
  /**
   * Identifier.
   */
  id?: string;

  /**
   * The date and time a signing key was created.
   */
  created?: string;

  /**
   * The signing key in JWK format.
   */
  jwk?: string;

  /**
   * The signing key in PEM format.
   */
  pem?: string;
}

export type KeyDeleteResponse = string;

export interface KeyGetResponse {
  /**
   * Identifier.
   */
  id?: string;

  /**
   * The date and time a signing key was created.
   */
  created?: string;
}

export interface KeyCreateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param:
   */
  body: unknown;
}

export interface KeyDeleteParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export interface KeyGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

Keys.KeyGetResponsesSinglePage = KeyGetResponsesSinglePage;

export declare namespace Keys {
  export {
    type Keys as Keys,
    type KeyDeleteResponse as KeyDeleteResponse,
    type KeyGetResponse as KeyGetResponse,
    KeyGetResponsesSinglePage as KeyGetResponsesSinglePage,
    type KeyCreateParams as KeyCreateParams,
    type KeyDeleteParams as KeyDeleteParams,
    type KeyGetParams as KeyGetParams,
  };
}
