// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as KeysAPI from './keys';
import {
  Key,
  KeyBulkDeleteParams,
  KeyBulkDeleteResponse,
  KeyBulkGetParams,
  KeyBulkGetResponse,
  KeyBulkUpdateParams,
  KeyBulkUpdateResponse,
  KeyListParams,
  Keys,
  KeysCursorLimitPagination,
} from './keys';
import * as MetadataAPI from './metadata';
import { Metadata, MetadataGetParams, MetadataGetResponse } from './metadata';
import * as ValuesAPI from './values';
import {
  ValueDeleteParams,
  ValueDeleteResponse,
  ValueGetParams,
  ValueUpdateParams,
  ValueUpdateResponse,
  Values as ValuesAPIValues,
} from './values';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../../pagination';

export class Namespaces extends APIResource {
  keys: KeysAPI.Keys = new KeysAPI.Keys(this._client);
  metadata: MetadataAPI.Metadata = new MetadataAPI.Metadata(this._client);
  values: ValuesAPI.Values = new ValuesAPI.Values(this._client);

  /**
   * Creates a namespace under the given title. A `400` is returned if the account
   * already owns a namespace with this title. A namespace must be explicitly deleted
   * to be replaced.
   *
   * @example
   * ```ts
   * const namespace = await client.kv.namespaces.create({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   title: 'My Own Namespace',
   * });
   * ```
   */
  create(params: NamespaceCreateParams, options?: Core.RequestOptions): Core.APIPromise<Namespace> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/storage/kv/namespaces`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Namespace }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Modifies a namespace's title.
   *
   * @example
   * ```ts
   * const namespace = await client.kv.namespaces.update(
   *   '0f2ac74b498b48028cb68387c421e279',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     title: 'My Own Namespace',
   *   },
   * );
   * ```
   */
  update(
    namespaceId: string,
    params: NamespaceUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Namespace> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Namespace }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Returns the namespaces owned by an account.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const namespace of client.kv.namespaces.list({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * })) {
   *   // ...
   * }
   * ```
   */
  list(
    params: NamespaceListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<NamespacesV4PagePaginationArray, Namespace> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/storage/kv/namespaces`,
      NamespacesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Deletes the namespace corresponding to the given ID.
   *
   * @example
   * ```ts
   * const namespace = await client.kv.namespaces.delete(
   *   '0f2ac74b498b48028cb68387c421e279',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    namespaceId: string,
    params: NamespaceDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<NamespaceDeleteResponse | null> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/storage/kv/namespaces/${namespaceId}`,
        options,
      ) as Core.APIPromise<{ result: NamespaceDeleteResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Remove multiple KV pairs from the namespace. Body should be an array of up to
   * 10,000 keys to be removed.
   *
   * @example
   * ```ts
   * const response = await client.kv.namespaces.bulkDelete(
   *   '0f2ac74b498b48028cb68387c421e279',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     body: ['My-Key'],
   *   },
   * );
   * ```
   */
  bulkDelete(
    namespaceId: string,
    params: NamespaceBulkDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<NamespaceBulkDeleteResponse | null> {
    const { account_id, body } = params;
    return (
      this._client.post(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}/bulk/delete`, {
        body: body,
        ...options,
      }) as Core.APIPromise<{ result: NamespaceBulkDeleteResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieve up to 100 KV pairs from the namespace. Keys must contain text-based
   * values. JSON values can optionally be parsed instead of being returned as a
   * string value. Metadata can be included if `withMetadata` is true.
   *
   * @example
   * ```ts
   * const response = await client.kv.namespaces.bulkGet(
   *   '0f2ac74b498b48028cb68387c421e279',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     keys: ['My-Key'],
   *   },
   * );
   * ```
   */
  bulkGet(
    namespaceId: string,
    params: NamespaceBulkGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<NamespaceBulkGetResponse | null> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}/bulk/get`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: NamespaceBulkGetResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Write multiple keys and values at once. Body should be an array of up to 10,000
   * key-value pairs to be stored, along with optional expiration information.
   * Existing values and expirations will be overwritten. If neither `expiration` nor
   * `expiration_ttl` is specified, the key-value pair will never expire. If both are
   * set, `expiration_ttl` is used and `expiration` is ignored. The entire request
   * size must be 100 megabytes or less.
   *
   * @example
   * ```ts
   * const response = await client.kv.namespaces.bulkUpdate(
   *   '0f2ac74b498b48028cb68387c421e279',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     body: [{ key: 'My-Key', value: 'Some string' }],
   *   },
   * );
   * ```
   */
  bulkUpdate(
    namespaceId: string,
    params: NamespaceBulkUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<NamespaceBulkUpdateResponse | null> {
    const { account_id, body } = params;
    return (
      this._client.put(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}/bulk`, {
        body: body,
        ...options,
      }) as Core.APIPromise<{ result: NamespaceBulkUpdateResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get the namespace corresponding to the given ID.
   *
   * @example
   * ```ts
   * const namespace = await client.kv.namespaces.get(
   *   '0f2ac74b498b48028cb68387c421e279',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    namespaceId: string,
    params: NamespaceGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Namespace> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/storage/kv/namespaces/${namespaceId}`,
        options,
      ) as Core.APIPromise<{ result: Namespace }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class NamespacesV4PagePaginationArray extends V4PagePaginationArray<Namespace> {}

export interface Namespace {
  /**
   * Namespace identifier tag.
   */
  id: string;

  /**
   * A human-readable string name for a Namespace.
   */
  title: string;

  /**
   * True if new beta namespace, with additional preview features.
   */
  beta?: boolean;

  /**
   * True if keys written on the URL will be URL-decoded before storing. For example,
   * if set to "true", a key written on the URL as "%3F" will be stored as "?".
   */
  supports_url_encoding?: boolean;
}

export interface NamespaceDeleteResponse {}

export interface NamespaceBulkDeleteResponse {
  /**
   * Number of keys successfully updated.
   */
  successful_key_count?: number;

  /**
   * Name of the keys that failed to be fully updated. They should be retried.
   */
  unsuccessful_keys?: Array<string>;
}

export type NamespaceBulkGetResponse =
  | NamespaceBulkGetResponse.WorkersKVBulkGetResult
  | NamespaceBulkGetResponse.WorkersKVBulkGetResultWithMetadata;

export namespace NamespaceBulkGetResponse {
  export interface WorkersKVBulkGetResult {
    /**
     * Requested keys are paired with their values in an object.
     */
    values?: { [key: string]: string | number | boolean | { [key: string]: unknown } };
  }

  export interface WorkersKVBulkGetResultWithMetadata {
    /**
     * Requested keys are paired with their values and metadata in an object.
     */
    values?: { [key: string]: WorkersKVBulkGetResultWithMetadata.Values | null };
  }

  export namespace WorkersKVBulkGetResultWithMetadata {
    export interface Values {
      metadata: unknown;

      value: unknown;

      /**
       * Expires the key at a certain time, measured in number of seconds since the UNIX
       * epoch.
       */
      expiration?: number;
    }
  }
}

export interface NamespaceBulkUpdateResponse {
  /**
   * Number of keys successfully updated.
   */
  successful_key_count?: number;

  /**
   * Name of the keys that failed to be fully updated. They should be retried.
   */
  unsuccessful_keys?: Array<string>;
}

export interface NamespaceCreateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: A human-readable string name for a Namespace.
   */
  title: string;
}

export interface NamespaceUpdateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: A human-readable string name for a Namespace.
   */
  title: string;
}

export interface NamespaceListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Query param: Direction to order namespaces.
   */
  direction?: 'asc' | 'desc';

  /**
   * Query param: Field to order results by.
   */
  order?: 'id' | 'title';
}

export interface NamespaceDeleteParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export interface NamespaceBulkDeleteParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param:
   */
  body: Array<string>;
}

export interface NamespaceBulkGetParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: Array of keys to retrieve (maximum of 100).
   */
  keys: Array<string>;

  /**
   * Body param: Whether to parse JSON values in the response.
   */
  type?: 'text' | 'json';

  /**
   * Body param: Whether to include metadata in the response.
   */
  withMetadata?: boolean;
}

export interface NamespaceBulkUpdateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param:
   */
  body: Array<NamespaceBulkUpdateParams.Body>;
}

export namespace NamespaceBulkUpdateParams {
  export interface Body {
    /**
     * A key's name. The name may be at most 512 bytes. All printable, non-whitespace
     * characters are valid.
     */
    key: string;

    /**
     * A UTF-8 encoded string to be stored, up to 25 MiB in length.
     */
    value: string;

    /**
     * Indicates whether or not the server should base64 decode the value before
     * storing it. Useful for writing values that wouldn't otherwise be valid JSON
     * strings, such as images.
     */
    base64?: boolean;

    /**
     * Expires the key at a certain time, measured in number of seconds since the UNIX
     * epoch.
     */
    expiration?: number;

    /**
     * Expires the key after a number of seconds. Must be at least 60.
     */
    expiration_ttl?: number;

    metadata?: unknown;
  }
}

export interface NamespaceGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

Namespaces.NamespacesV4PagePaginationArray = NamespacesV4PagePaginationArray;
Namespaces.Keys = Keys;
Namespaces.KeysCursorLimitPagination = KeysCursorLimitPagination;
Namespaces.Metadata = Metadata;
Namespaces.Values = ValuesAPIValues;

export declare namespace Namespaces {
  export {
    type Namespace as Namespace,
    type NamespaceDeleteResponse as NamespaceDeleteResponse,
    type NamespaceBulkDeleteResponse as NamespaceBulkDeleteResponse,
    type NamespaceBulkGetResponse as NamespaceBulkGetResponse,
    type NamespaceBulkUpdateResponse as NamespaceBulkUpdateResponse,
    NamespacesV4PagePaginationArray as NamespacesV4PagePaginationArray,
    type NamespaceCreateParams as NamespaceCreateParams,
    type NamespaceUpdateParams as NamespaceUpdateParams,
    type NamespaceListParams as NamespaceListParams,
    type NamespaceDeleteParams as NamespaceDeleteParams,
    type NamespaceBulkDeleteParams as NamespaceBulkDeleteParams,
    type NamespaceBulkGetParams as NamespaceBulkGetParams,
    type NamespaceBulkUpdateParams as NamespaceBulkUpdateParams,
    type NamespaceGetParams as NamespaceGetParams,
  };

  export {
    Keys as Keys,
    type Key as Key,
    type KeyBulkDeleteResponse as KeyBulkDeleteResponse,
    type KeyBulkGetResponse as KeyBulkGetResponse,
    type KeyBulkUpdateResponse as KeyBulkUpdateResponse,
    KeysCursorLimitPagination as KeysCursorLimitPagination,
    type KeyListParams as KeyListParams,
    type KeyBulkDeleteParams as KeyBulkDeleteParams,
    type KeyBulkGetParams as KeyBulkGetParams,
    type KeyBulkUpdateParams as KeyBulkUpdateParams,
  };

  export {
    Metadata as Metadata,
    type MetadataGetResponse as MetadataGetResponse,
    type MetadataGetParams as MetadataGetParams,
  };

  export {
    ValuesAPIValues as Values,
    type ValueUpdateResponse as ValueUpdateResponse,
    type ValueDeleteResponse as ValueDeleteResponse,
    type ValueUpdateParams as ValueUpdateParams,
    type ValueDeleteParams as ValueDeleteParams,
    type ValueGetParams as ValueGetParams,
  };
}
