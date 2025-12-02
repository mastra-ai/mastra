// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { type Response } from '../../../_shims/index';

export class Values extends APIResource {
  /**
   * Write a value identified by a key. Use URL-encoding to use special characters
   * (for example, `:`, `!`, `%`) in the key name. Body should be the value to be
   * stored. If JSON metadata to be associated with the key/value pair is needed, use
   * `multipart/form-data` content type for your PUT request (see dropdown below in
   * `REQUEST BODY SCHEMA`). Existing values, expirations, and metadata will be
   * overwritten. If neither `expiration` nor `expiration_ttl` is specified, the
   * key-value pair will never expire. If both are set, `expiration_ttl` is used and
   * `expiration` is ignored.
   *
   * @example
   * ```ts
   * const value = await client.kv.namespaces.values.update(
   *   '0f2ac74b498b48028cb68387c421e279',
   *   'My-Key',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     value: 'Some Value',
   *   },
   * );
   * ```
   */
  update(
    namespaceId: string,
    keyName: string,
    params: ValueUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ValueUpdateResponse | null> {
    const { account_id, expiration, expiration_ttl, ...body } = params;
    return (
      this._client.put(
        `/accounts/${account_id}/storage/kv/namespaces/${namespaceId}/values/${keyName}`,
        Core.multipartFormRequestOptions({ query: { expiration, expiration_ttl }, body, ...options }),
      ) as Core.APIPromise<{ result: ValueUpdateResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Remove a KV pair from the namespace. Use URL-encoding to use special characters
   * (for example, `:`, `!`, `%`) in the key name.
   *
   * @example
   * ```ts
   * const value = await client.kv.namespaces.values.delete(
   *   '0f2ac74b498b48028cb68387c421e279',
   *   'My-Key',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    namespaceId: string,
    keyName: string,
    params: ValueDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ValueDeleteResponse | null> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/storage/kv/namespaces/${namespaceId}/values/${keyName}`,
        options,
      ) as Core.APIPromise<{ result: ValueDeleteResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Returns the value associated with the given key in the given namespace. Use
   * URL-encoding to use special characters (for example, `:`, `!`, `%`) in the key
   * name. If the KV-pair is set to expire at some point, the expiration time as
   * measured in seconds since the UNIX epoch will be returned in the `expiration`
   * response header.
   *
   * @example
   * ```ts
   * const value = await client.kv.namespaces.values.get(
   *   '0f2ac74b498b48028cb68387c421e279',
   *   'My-Key',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   *
   * const content = await value.blob();
   * console.log(content);
   * ```
   */
  get(
    namespaceId: string,
    keyName: string,
    params: ValueGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Response> {
    const { account_id } = params;
    return this._client.get(
      `/accounts/${account_id}/storage/kv/namespaces/${namespaceId}/values/${keyName}`,
      {
        ...options,
        headers: { Accept: 'application/octet-stream', ...options?.headers },
        __binaryResponse: true,
      },
    );
  }
}

export interface ValueUpdateResponse {}

export interface ValueDeleteResponse {}

export interface ValueUpdateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: A byte sequence to be stored, up to 25 MiB in length.
   */
  value: string;

  /**
   * Query param: Expires the key at a certain time, measured in number of seconds
   * since the UNIX epoch.
   */
  expiration?: number;

  /**
   * Query param: Expires the key after a number of seconds. Must be at least 60.
   */
  expiration_ttl?: number;

  /**
   * Body param:
   */
  metadata?: unknown;
}

export interface ValueDeleteParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export interface ValueGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export declare namespace Values {
  export {
    type ValueUpdateResponse as ValueUpdateResponse,
    type ValueDeleteResponse as ValueDeleteResponse,
    type ValueUpdateParams as ValueUpdateParams,
    type ValueDeleteParams as ValueDeleteParams,
    type ValueGetParams as ValueGetParams,
  };
}
