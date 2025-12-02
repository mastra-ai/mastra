// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as SecretsAPI from './secrets';
import {
  SecretBulkDeleteParams,
  SecretBulkDeleteResponse,
  SecretBulkDeleteResponsesSinglePage,
  SecretCreateParams,
  SecretCreateResponse,
  SecretCreateResponsesSinglePage,
  SecretDeleteParams,
  SecretDeleteResponse,
  SecretDuplicateParams,
  SecretDuplicateResponse,
  SecretEditParams,
  SecretEditResponse,
  SecretGetParams,
  SecretGetResponse,
  SecretListParams,
  SecretListResponse,
  SecretListResponsesV4PagePaginationArray,
  Secrets,
} from './secrets';
import { SinglePage, V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../../pagination';

export class Stores extends APIResource {
  secrets: SecretsAPI.Secrets = new SecretsAPI.Secrets(this._client);

  /**
   * Creates a store in the account
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const storeCreateResponse of client.secretsStore.stores.create(
   *   {
   *     account_id: '985e105f4ecef8ad9ca31a8372d0c353',
   *     body: [{ name: 'service_x_keys' }],
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  create(
    params: StoreCreateParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<StoreCreateResponsesSinglePage, StoreCreateResponse> {
    const { account_id, body } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/secrets_store/stores`,
      StoreCreateResponsesSinglePage,
      { body: body, method: 'post', ...options },
    );
  }

  /**
   * Lists all the stores in an account
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const storeListResponse of client.secretsStore.stores.list(
   *   { account_id: '985e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: StoreListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<StoreListResponsesV4PagePaginationArray, StoreListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/secrets_store/stores`,
      StoreListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Deletes a single store
   *
   * @example
   * ```ts
   * const store = await client.secretsStore.stores.delete(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '985e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    storeId: string,
    params: StoreDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<StoreDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/secrets_store/stores/${storeId}`,
        options,
      ) as Core.APIPromise<{ result: StoreDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class StoreCreateResponsesSinglePage extends SinglePage<StoreCreateResponse> {}

export class StoreListResponsesV4PagePaginationArray extends V4PagePaginationArray<StoreListResponse> {}

export interface StoreCreateResponse {
  /**
   * Store Identifier
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
   * The name of the store
   */
  name: string;
}

export interface StoreListResponse {
  /**
   * Store Identifier
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
   * The name of the store
   */
  name: string;
}

export interface StoreDeleteResponse {
  /**
   * Store Identifier
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
   * The name of the store
   */
  name: string;
}

export interface StoreCreateParams {
  /**
   * Path param: Account Identifier
   */
  account_id: string;

  /**
   * Body param:
   */
  body: Array<StoreCreateParams.Body>;
}

export namespace StoreCreateParams {
  export interface Body {
    /**
     * The name of the store
     */
    name: string;
  }
}

export interface StoreListParams extends V4PagePaginationArrayParams {
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
}

export interface StoreDeleteParams {
  /**
   * Account Identifier
   */
  account_id: string;
}

Stores.StoreCreateResponsesSinglePage = StoreCreateResponsesSinglePage;
Stores.StoreListResponsesV4PagePaginationArray = StoreListResponsesV4PagePaginationArray;
Stores.Secrets = Secrets;
Stores.SecretCreateResponsesSinglePage = SecretCreateResponsesSinglePage;
Stores.SecretListResponsesV4PagePaginationArray = SecretListResponsesV4PagePaginationArray;
Stores.SecretBulkDeleteResponsesSinglePage = SecretBulkDeleteResponsesSinglePage;

export declare namespace Stores {
  export {
    type StoreCreateResponse as StoreCreateResponse,
    type StoreListResponse as StoreListResponse,
    type StoreDeleteResponse as StoreDeleteResponse,
    StoreCreateResponsesSinglePage as StoreCreateResponsesSinglePage,
    StoreListResponsesV4PagePaginationArray as StoreListResponsesV4PagePaginationArray,
    type StoreCreateParams as StoreCreateParams,
    type StoreListParams as StoreListParams,
    type StoreDeleteParams as StoreDeleteParams,
  };

  export {
    Secrets as Secrets,
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
