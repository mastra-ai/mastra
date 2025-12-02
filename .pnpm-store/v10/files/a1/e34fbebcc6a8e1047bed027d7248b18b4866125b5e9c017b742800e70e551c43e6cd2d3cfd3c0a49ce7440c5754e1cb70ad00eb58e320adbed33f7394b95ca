// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage, V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../../pagination';

export class Members extends APIResource {
  /**
   * Add members to a User Group.
   *
   * @example
   * ```ts
   * const member = await client.iam.userGroups.members.create(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     body: [{ id: '023e105f4ecef8ad9ca31a8372d0c353' }],
   *   },
   * );
   * ```
   */
  create(
    userGroupId: string,
    params: MemberCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<MemberCreateResponse> {
    const { account_id, body } = params;
    return (
      this._client.post(`/accounts/${account_id}/iam/user_groups/${userGroupId}/members`, {
        body: body,
        ...options,
      }) as Core.APIPromise<{ result: MemberCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Replace the set of members attached to a User Group.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const memberUpdateResponse of client.iam.userGroups.members.update(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     body: [{ id: '023e105f4ecef8ad9ca31a8372d0c353' }],
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  update(
    userGroupId: string,
    params: MemberUpdateParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<MemberUpdateResponsesSinglePage, MemberUpdateResponse> {
    const { account_id, body } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/iam/user_groups/${userGroupId}/members`,
      MemberUpdateResponsesSinglePage,
      { body: body, method: 'put', ...options },
    );
  }

  /**
   * List all the members attached to a user group.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const memberListResponse of client.iam.userGroups.members.list(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    userGroupId: string,
    params: MemberListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<MemberListResponsesV4PagePaginationArray, MemberListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/iam/user_groups/${userGroupId}/members`,
      MemberListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Remove a member from User Group
   *
   * @example
   * ```ts
   * const member = await client.iam.userGroups.members.delete(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    userGroupId: string,
    memberId: string,
    params: MemberDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<MemberDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/iam/user_groups/${userGroupId}/members/${memberId}`,
        options,
      ) as Core.APIPromise<{ result: MemberDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class MemberUpdateResponsesSinglePage extends SinglePage<MemberUpdateResponse> {}

export class MemberListResponsesV4PagePaginationArray extends V4PagePaginationArray<MemberListResponse> {}

/**
 * Member attached to a User Group.
 */
export interface MemberCreateResponse {
  /**
   * Account member identifier.
   */
  id: string;

  /**
   * The contact email address of the user.
   */
  email?: string;

  /**
   * The member's status in the account.
   */
  status?: 'accepted' | 'pending';
}

/**
 * Member attached to a User Group.
 */
export interface MemberUpdateResponse {
  /**
   * Account member identifier.
   */
  id: string;

  /**
   * The contact email address of the user.
   */
  email?: string;

  /**
   * The member's status in the account.
   */
  status?: 'accepted' | 'pending';
}

/**
 * Member attached to a User Group.
 */
export interface MemberListResponse {
  /**
   * Account member identifier.
   */
  id: string;

  /**
   * The contact email address of the user.
   */
  email?: string;

  /**
   * The member's status in the account.
   */
  status?: 'accepted' | 'pending';
}

/**
 * Member attached to a User Group.
 */
export interface MemberDeleteResponse {
  /**
   * Account member identifier.
   */
  id: string;

  /**
   * The contact email address of the user.
   */
  email?: string;

  /**
   * The member's status in the account.
   */
  status?: 'accepted' | 'pending';
}

export interface MemberCreateParams {
  /**
   * Path param: Account identifier tag.
   */
  account_id: string;

  /**
   * Body param:
   */
  body: Array<MemberCreateParams.Body>;
}

export namespace MemberCreateParams {
  export interface Body {
    /**
     * The identifier of an existing account Member.
     */
    id: string;
  }
}

export interface MemberUpdateParams {
  /**
   * Path param: Account identifier tag.
   */
  account_id: string;

  /**
   * Body param: Set/Replace members to a user group.
   */
  body: Array<MemberUpdateParams.Body>;
}

export namespace MemberUpdateParams {
  export interface Body {
    /**
     * The identifier of an existing account Member.
     */
    id: string;
  }
}

export interface MemberListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Account identifier tag.
   */
  account_id: string;
}

export interface MemberDeleteParams {
  /**
   * Account identifier tag.
   */
  account_id: string;
}

Members.MemberUpdateResponsesSinglePage = MemberUpdateResponsesSinglePage;
Members.MemberListResponsesV4PagePaginationArray = MemberListResponsesV4PagePaginationArray;

export declare namespace Members {
  export {
    type MemberCreateResponse as MemberCreateResponse,
    type MemberUpdateResponse as MemberUpdateResponse,
    type MemberListResponse as MemberListResponse,
    type MemberDeleteResponse as MemberDeleteResponse,
    MemberUpdateResponsesSinglePage as MemberUpdateResponsesSinglePage,
    MemberListResponsesV4PagePaginationArray as MemberListResponsesV4PagePaginationArray,
    type MemberCreateParams as MemberCreateParams,
    type MemberUpdateParams as MemberUpdateParams,
    type MemberListParams as MemberListParams,
    type MemberDeleteParams as MemberDeleteParams,
  };
}
