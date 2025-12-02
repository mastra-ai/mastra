// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../../resource';
import * as Core from '../../../../../core';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../../../../pagination';

export class Users extends APIResource {
  /**
   * Fetches a single page of user results from an Access policy test.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const userListResponse of client.zeroTrust.access.applications.policyTests.users.list(
   *   'f1a8b3c9d4e5f6789a0b1c2d3e4f5678a9b0c1d2e3f4a5b67890c1d2e3f4b5a6',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    policyTestId: string,
    params: UserListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<UserListResponsesV4PagePaginationArray, UserListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/access/policy-tests/${policyTestId}/users`,
      UserListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }
}

export class UserListResponsesV4PagePaginationArray extends V4PagePaginationArray<UserListResponse> {}

export interface UserListResponse {
  /**
   * UUID.
   */
  id?: string;

  /**
   * The email of the user.
   */
  email?: string;

  /**
   * The name of the user.
   */
  name?: string;

  /**
   * Policy evaluation result for an individual user.
   */
  status?: 'approved' | 'blocked' | 'error';
}

export interface UserListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Query param: Filter users by their policy evaluation status.
   */
  status?: 'success' | 'fail' | 'error';
}

Users.UserListResponsesV4PagePaginationArray = UserListResponsesV4PagePaginationArray;

export declare namespace Users {
  export {
    type UserListResponse as UserListResponse,
    UserListResponsesV4PagePaginationArray as UserListResponsesV4PagePaginationArray,
    type UserListParams as UserListParams,
  };
}
