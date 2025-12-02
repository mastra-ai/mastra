// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage, V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../../pagination';

export class Secrets extends APIResource {
  /**
   * Creates a secret in the account
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const secretCreateResponse of client.secretsStore.stores.secrets.create(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   {
   *     account_id: '985e105f4ecef8ad9ca31a8372d0c353',
   *     body: [
   *       {
   *         name: 'MY_API_KEY',
   *         scopes: ['workers'],
   *         value: 'api-token-secret-123',
   *       },
   *     ],
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  create(
    storeId: string,
    params: SecretCreateParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<SecretCreateResponsesSinglePage, SecretCreateResponse> {
    const { account_id, body } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/secrets_store/stores/${storeId}/secrets`,
      SecretCreateResponsesSinglePage,
      { body: body, method: 'post', ...options },
    );
  }

  /**
   * Lists all store secrets
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const secretListResponse of client.secretsStore.stores.secrets.list(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '985e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    storeId: string,
    params: SecretListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<SecretListResponsesV4PagePaginationArray, SecretListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/secrets_store/stores/${storeId}/secrets`,
      SecretListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Deletes a single secret
   *
   * @example
   * ```ts
   * const secret =
   *   await client.secretsStore.stores.secrets.delete(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     '3fd85f74b32742f1bff64a85009dda07',
   *     { account_id: '985e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  delete(
    storeId: string,
    secretId: string,
    params: SecretDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SecretDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/secrets_store/stores/${storeId}/secrets/${secretId}`,
        options,
      ) as Core.APIPromise<{ result: SecretDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Deletes one or more secrets
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const secretBulkDeleteResponse of client.secretsStore.stores.secrets.bulkDelete(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '985e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  bulkDelete(
    storeId: string,
    params: SecretBulkDeleteParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<SecretBulkDeleteResponsesSinglePage, SecretBulkDeleteResponse> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/secrets_store/stores/${storeId}/secrets`,
      SecretBulkDeleteResponsesSinglePage,
      { method: 'delete', ...options },
    );
  }

  /**
   * Duplicates the secret, keeping the value
   *
   * @example
   * ```ts
   * const response =
   *   await client.secretsStore.stores.secrets.duplicate(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     '3fd85f74b32742f1bff64a85009dda07',
   *     {
   *       account_id: '985e105f4ecef8ad9ca31a8372d0c353',
   *       name: 'MY_API_KEY',
   *     },
   *   );
   * ```
   */
  duplicate(
    storeId: string,
    secretId: string,
    params: SecretDuplicateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SecretDuplicateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(
        `/accounts/${account_id}/secrets_store/stores/${storeId}/secrets/${secretId}/duplicate`,
        { body, ...options },
      ) as Core.APIPromise<{ result: SecretDuplicateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates a single secret
   *
   * @example
   * ```ts
   * const response =
   *   await client.secretsStore.stores.secrets.edit(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     '3fd85f74b32742f1bff64a85009dda07',
   *     {
   *       account_id: '985e105f4ecef8ad9ca31a8372d0c353',
   *       name: 'MY_API_KEY',
   *     },
   *   );
   * ```
   */
  edit(
    storeId: string,
    secretId: string,
    params: SecretEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SecretEditResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/secrets_store/stores/${storeId}/secrets/${secretId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: SecretEditResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Returns details of a single secret
   *
   * @example
   * ```ts
   * const secret = await client.secretsStore.stores.secrets.get(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   '3fd85f74b32742f1bff64a85009dda07',
   *   { account_id: '985e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    storeId: string,
    secretId: string,
    params: SecretGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SecretGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/secrets_store/stores/${storeId}/secrets/${secretId}`,
        options,
      ) as Core.APIPromise<{ result: SecretGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class SecretCreateResponsesSinglePage extends SinglePage<SecretCreateResponse> {}

export class SecretListResponsesV4PagePaginationArray extends V4PagePaginationArray<SecretListResponse> {}

export class SecretBulkDeleteResponsesSinglePage extends SinglePage<SecretBulkDeleteResponse> {}

export interface SecretCreateResponse {
  /**
   * Secret identifier tag.
   */
  id: string;

  /**
   * Whenthe secret was created.
   */
  created: string;

  /**
   * When the secret was modified.
   */
  modified: string;

  /**
   * The name of the secret
   */
  name: string;

  status: 'pending' | 'active' | 'deleted';

  /**
   * Store Identifier
   */
  store_id: string;

  /**
   * Freeform text describing the secret
   */
  comment?: string;
}

export interface SecretListResponse {
  /**
   * Secret identifier tag.
   */
  id: string;

  /**
   * Whenthe secret was created.
   */
  created: string;

  /**
   * When the secret was modified.
   */
  modified: string;

  /**
   * The name of the secret
   */
  name: string;

  status: 'pending' | 'active' | 'deleted';

  /**
   * Store Identifier
   */
  store_id: string;

  /**
   * Freeform text describing the secret
   */
  comment?: string;
}

export interface SecretDeleteResponse {
  /**
   * Secret identifier tag.
   */
  id: string;

  /**
   * Whenthe secret was created.
   */
  created: string;

  /**
   * When the secret was modified.
   */
  modified: string;

  /**
   * The name of the secret
   */
  name: string;

  status: 'pending' | 'active' | 'deleted';

  /**
   * Store Identifier
   */
  store_id: string;

  /**
   * Freeform text describing the secret
   */
  comment?: string;
}

export interface SecretBulkDeleteResponse {
  /**
   * Secret identifier tag.
   */
  id: string;

  /**
   * Whenthe secret was created.
   */
  created: string;

  /**
   * When the secret was modified.
   */
  modified: string;

  /**
   * The name of the secret
   */
  name: string;

  status: 'pending' | 'active' | 'deleted';

  /**
   * Store Identifier
   */
  store_id: string;

  /**
   * Freeform text describing the secret
   */
  comment?: string;
}

export interface SecretDuplicateResponse {
  /**
   * Secret identifier tag.
   */
  id: string;

  /**
   * Whenthe secret was created.
   */
  created: string;

  /**
   * When the secret was modified.
   */
  modified: string;

  /**
   * The name of the secret
   */
  name: string;

  status: 'pending' | 'active' | 'deleted';

  /**
   * Store Identifier
   */
  store_id: string;

  /**
   * Freeform text describing the secret
   */
  comment?: string;
}

export interface SecretEditResponse {
  /**
   * Secret identifier tag.
   */
  id: string;

  /**
   * Whenthe secret was created.
   */
  created: string;

  /**
   * When the secret was modified.
   */
  modified: string;

  /**
   * The name of the secret
   */
  name: string;

  status: 'pending' | 'active' | 'deleted';

  /**
   * Store Identifier
   */
  store_id: string;

  /**
   * Freeform text describing the secret
   */
  comment?: string;
}

export interface SecretGetResponse {
  /**
   * Secret identifier tag.
   */
  id: string;

  /**
   * Whenthe secret was created.
   */
  created: string;

  /**
   * When the secret was modified.
   */
  modified: string;

  /**
   * The name of the secret
   */
  name: string;

  status: 'pending' | 'active' | 'deleted';

  /**
   * Store Identifier
   */
  store_id: string;

  /**
   * Freeform text describing the secret
   */
  comment?: string;
}

export interface SecretCreateParams {
  /**
   * Path param: Account Identifier
   */
  account_id: string;

  /**
   * Body param:
   */
  body: Array<SecretCreateParams.Body>;
}

export namespace SecretCreateParams {
  export interface Body {
    /**
     * The name of the secret
     */
    name: string;

    /**
     * The list of services that can use this secret.
     */
    scopes: Array<string>;

    /**
     * The value of the secret. Note that this is 'write only' - no API reponse will
     * provide this value, it is only used to create/modify secrets.
     */
    value: string;
  }
}

export interface SecretListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Account Identifier
   */
  account_id: string;

  /**
   * Query param: Direction to sort objects
   */
  direction?: 'asc' | 'desc';

  /**
   * Query param: Order secrets by values in the given field
   */
  order?: 'name' | 'comment' | 'created' | 'modified' | 'status';

  /**
   * Query param: Search secrets using a filter string, filtering across name and
   * comment
   */
  search?: string;
}

export interface SecretDeleteParams {
  /**
   * Account Identifier
   */
  account_id: string;
}

export interface SecretBulkDeleteParams {
  /**
   * Account Identifier
   */
  account_id: string;
}

export interface SecretDuplicateParams {
  /**
   * Path param: Account Identifier
   */
  account_id: string;

  /**
   * Body param: The name of the secret
   */
  name: string;
}

export interface SecretEditParams {
  /**
   * Path param: Account Identifier
   */
  account_id: string;

  /**
   * Body param: The name of the secret
   */
  name: string;

  /**
   * Body param: The list of services that can use this secret.
   */
  scopes?: Array<string>;

  /**
   * Body param: The value of the secret. Note that this is 'write only' - no API
   * reponse will provide this value, it is only used to create/modify secrets.
   */
  value?: string;
}

export interface SecretGetParams {
  /**
   * Account Identifier
   */
  account_id: string;
}

Secrets.SecretCreateResponsesSinglePage = SecretCreateResponsesSinglePage;
Secrets.SecretListResponsesV4PagePaginationArray = SecretListResponsesV4PagePaginationArray;
Secrets.SecretBulkDeleteResponsesSinglePage = SecretBulkDeleteResponsesSinglePage;

export declare namespace Secrets {
  export {
    type SecretCreateResponse as SecretCreateResponse,
    type SecretListResponse as SecretListResponse,
    type SecretDeleteResponse as SecretDeleteResponse,
    type SecretBulkDeleteResponse as SecretBulkDeleteResponse,
    type SecretDuplicateResponse as SecretDuplicateResponse,
    type SecretEditResponse as SecretEditResponse,
    type SecretGetResponse as SecretGetResponse,
    SecretCreateResponsesSinglePage as SecretCreateResponsesSinglePage,
    SecretListResponsesV4PagePaginationArray as SecretListResponsesV4PagePaginationArray,
    SecretBulkDeleteResponsesSinglePage as SecretBulkDeleteResponsesSinglePage,
    type SecretCreateParams as SecretCreateParams,
    type SecretListParams as SecretListParams,
    type SecretDeleteParams as SecretDeleteParams,
    type SecretBulkDeleteParams as SecretBulkDeleteParams,
    type SecretDuplicateParams as SecretDuplicateParams,
    type SecretEditParams as SecretEditParams,
    type SecretGetParams as SecretGetParams,
  };
}
