// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import { isRequestOptions } from '../../../core';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class PermissionGroups extends APIResource {
  /**
   * Find all available permission groups for API Tokens
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const permissionGroupListResponse of client.user.tokens.permissionGroups.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query?: PermissionGroupListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<PermissionGroupListResponsesSinglePage, PermissionGroupListResponse>;
  list(
    options?: Core.RequestOptions,
  ): Core.PagePromise<PermissionGroupListResponsesSinglePage, PermissionGroupListResponse>;
  list(
    query: PermissionGroupListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.PagePromise<PermissionGroupListResponsesSinglePage, PermissionGroupListResponse> {
    if (isRequestOptions(query)) {
      return this.list({}, query);
    }
    return this._client.getAPIList('/user/tokens/permission_groups', PermissionGroupListResponsesSinglePage, {
      query,
      ...options,
    });
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

export interface PermissionGroupListParams {
  /**
   * Filter by the name of the permission group. The value must be URL-encoded.
   */
  name?: string;

  /**
   * Filter by the scope of the permission group. The value must be URL-encoded.
   */
  scope?: string;
}

PermissionGroups.PermissionGroupListResponsesSinglePage = PermissionGroupListResponsesSinglePage;

export declare namespace PermissionGroups {
  export {
    type PermissionGroupListResponse as PermissionGroupListResponse,
    PermissionGroupListResponsesSinglePage as PermissionGroupListResponsesSinglePage,
    type PermissionGroupListParams as PermissionGroupListParams,
  };
}
