// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class PermissionGroups extends APIResource {
  /**
   * Find all available permission groups for Account Owned API Tokens
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const permissionGroupListResponse of client.accounts.tokens.permissionGroups.list(
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: PermissionGroupListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<PermissionGroupListResponsesSinglePage, PermissionGroupListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/tokens/permission_groups`,
      PermissionGroupListResponsesSinglePage,
      { query, ...options },
    );
  }

  /**
   * Find all available permission groups for Account Owned API Tokens
   *
   * @example
   * ```ts
   * const permissionGroups =
   *   await client.accounts.tokens.permissionGroups.get({
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  get(
    params: PermissionGroupGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PermissionGroupGetResponse> {
    const { account_id, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/tokens/permission_groups`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: PermissionGroupGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class PermissionGroupListResponsesSinglePage extends SinglePage<PermissionGroupListResponse> {}

export interface PermissionGroupListResponse {
  /**
   * Public ID.
   */
  id?: string;

  /**
   * Permission Group Name
   */
  name?: string;

  /**
   * Resources to which the Permission Group is scoped
   */
  scopes?: Array<
    | 'com.cloudflare.api.account'
    | 'com.cloudflare.api.account.zone'
    | 'com.cloudflare.api.user'
    | 'com.cloudflare.edge.r2.bucket'
  >;
}

export type PermissionGroupGetResponse = Array<PermissionGroupGetResponse.PermissionGroupGetResponseItem>;

export namespace PermissionGroupGetResponse {
  export interface PermissionGroupGetResponseItem {
    /**
     * Public ID.
     */
    id?: string;

    /**
     * Permission Group Name
     */
    name?: string;

    /**
     * Resources to which the Permission Group is scoped
     */
    scopes?: Array<
      | 'com.cloudflare.api.account'
      | 'com.cloudflare.api.account.zone'
      | 'com.cloudflare.api.user'
      | 'com.cloudflare.edge.r2.bucket'
    >;
  }
}

export interface PermissionGroupListParams {
  /**
   * Path param: Account identifier tag.
   */
  account_id: string;

  /**
   * Query param: Filter by the name of the permission group. The value must be
   * URL-encoded.
   */
  name?: string;

  /**
   * Query param: Filter by the scope of the permission group. The value must be
   * URL-encoded.
   */
  scope?: string;
}

export interface PermissionGroupGetParams {
  /**
   * Path param: Account identifier tag.
   */
  account_id: string;

  /**
   * Query param: Filter by the name of the permission group. The value must be
   * URL-encoded.
   */
  name?: string;

  /**
   * Query param: Filter by the scope of the permission group. The value must be
   * URL-encoded.
   */
  scope?: string;
}

PermissionGroups.PermissionGroupListResponsesSinglePage = PermissionGroupListResponsesSinglePage;

export declare namespace PermissionGroups {
  export {
    type PermissionGroupListResponse as PermissionGroupListResponse,
    type PermissionGroupGetResponse as PermissionGroupGetResponse,
    PermissionGroupListResponsesSinglePage as PermissionGroupListResponsesSinglePage,
    type PermissionGroupListParams as PermissionGroupListParams,
    type PermissionGroupGetParams as PermissionGroupGetParams,
  };
}
