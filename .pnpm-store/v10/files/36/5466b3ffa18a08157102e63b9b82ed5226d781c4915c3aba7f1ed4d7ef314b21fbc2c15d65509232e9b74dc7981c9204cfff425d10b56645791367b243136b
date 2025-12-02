// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as Shared from '../shared';
import { MembersV4PagePaginationArray } from '../shared';
import { type V4PagePaginationArrayParams } from '../../pagination';

export class Members extends APIResource {
  /**
   * Add a user to the list of members for this account.
   *
   * @example
   * ```ts
   * const member = await client.accounts.members.create({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   email: 'user@example.com',
   *   roles: ['3536bcfad5faccb999b47003c79917fb'],
   * });
   * ```
   */
  create(params: MemberCreateParams, options?: Core.RequestOptions): Core.APIPromise<Shared.Member> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/members`, { body, ...options }) as Core.APIPromise<{
        result: Shared.Member;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Modify an account member.
   *
   * @example
   * ```ts
   * const member = await client.accounts.members.update(
   *   '4536bcfad5faccb111b47003c79917fa',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  update(
    memberId: string,
    params: MemberUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Shared.Member> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/members/${memberId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Shared.Member }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List all members of an account.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const member of client.accounts.members.list({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * })) {
   *   // ...
   * }
   * ```
   */
  list(
    params: MemberListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<MembersV4PagePaginationArray, Shared.Member> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(`/accounts/${account_id}/members`, MembersV4PagePaginationArray, {
      query,
      ...options,
    });
  }

  /**
   * Remove a member from an account.
   *
   * @example
   * ```ts
   * const member = await client.accounts.members.delete(
   *   '4536bcfad5faccb111b47003c79917fa',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    memberId: string,
    params: MemberDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<MemberDeleteResponse | null> {
    const { account_id } = params;
    return (
      this._client.delete(`/accounts/${account_id}/members/${memberId}`, options) as Core.APIPromise<{
        result: MemberDeleteResponse | null;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get information about a specific member of an account.
   *
   * @example
   * ```ts
   * const member = await client.accounts.members.get(
   *   '4536bcfad5faccb111b47003c79917fa',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    memberId: string,
    params: MemberGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Shared.Member> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/members/${memberId}`, options) as Core.APIPromise<{
        result: Shared.Member;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * Whether the user is a member of the organization or has an invitation pending.
 */
export type Status = 'member' | 'invited';

export interface MemberDeleteResponse {
  /**
   * Identifier
   */
  id: string;
}

export type MemberCreateParams =
  | MemberCreateParams.IAMCreateMemberWithRoles
  | MemberCreateParams.IAMCreateMemberWithPolicies;

export declare namespace MemberCreateParams {
  export interface IAMCreateMemberWithRoles {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;

    /**
     * Body param: The contact email address of the user.
     */
    email: string;

    /**
     * Body param: Array of roles associated with this member.
     */
    roles: Array<string>;

    /**
     * Body param:
     */
    status?: 'accepted' | 'pending';
  }

  export interface IAMCreateMemberWithPolicies {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;

    /**
     * Body param: The contact email address of the user.
     */
    email: string;

    /**
     * Body param: Array of policies associated with this member.
     */
    policies: Array<IAMCreateMemberWithPolicies.Policy>;

    /**
     * Body param:
     */
    status?: 'accepted' | 'pending';
  }

  export namespace IAMCreateMemberWithPolicies {
    export interface Policy {
      /**
       * Allow or deny operations against the resources.
       */
      access: 'allow' | 'deny';

      /**
       * A set of permission groups that are specified to the policy.
       */
      permission_groups: Array<Policy.PermissionGroup>;

      /**
       * A list of resource groups that the policy applies to.
       */
      resource_groups: Array<Policy.ResourceGroup>;
    }

    export namespace Policy {
      /**
       * A group of permissions.
       */
      export interface PermissionGroup {
        /**
         * Identifier of the group.
         */
        id: string;
      }

      /**
       * A group of scoped resources.
       */
      export interface ResourceGroup {
        /**
         * Identifier of the group.
         */
        id: string;
      }
    }
  }
}

export type MemberUpdateParams =
  | MemberUpdateParams.IAMUpdateMemberWithRoles
  | MemberUpdateParams.IAMUpdateMemberWithPolicies;

export declare namespace MemberUpdateParams {
  export interface IAMUpdateMemberWithRoles {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;

    /**
     * Body param: Roles assigned to this member.
     */
    roles?: Array<Shared.RoleParam>;
  }

  export interface IAMUpdateMemberWithPolicies {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;

    /**
     * Body param: Array of policies associated with this member.
     */
    policies: Array<IAMUpdateMemberWithPolicies.Policy>;
  }

  export namespace IAMUpdateMemberWithPolicies {
    export interface Policy {
      /**
       * Allow or deny operations against the resources.
       */
      access: 'allow' | 'deny';

      /**
       * A set of permission groups that are specified to the policy.
       */
      permission_groups: Array<Policy.PermissionGroup>;

      /**
       * A list of resource groups that the policy applies to.
       */
      resource_groups: Array<Policy.ResourceGroup>;
    }

    export namespace Policy {
      /**
       * A group of permissions.
       */
      export interface PermissionGroup {
        /**
         * Identifier of the group.
         */
        id: string;
      }

      /**
       * A group of scoped resources.
       */
      export interface ResourceGroup {
        /**
         * Identifier of the group.
         */
        id: string;
      }
    }
  }
}

export interface MemberListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Account identifier tag.
   */
  account_id: string;

  /**
   * Query param: Direction to order results.
   */
  direction?: 'asc' | 'desc';

  /**
   * Query param: Field to order results by.
   */
  order?: 'user.first_name' | 'user.last_name' | 'user.email' | 'status';

  /**
   * Query param: A member's status in the account.
   */
  status?: 'accepted' | 'pending' | 'rejected';
}

export interface MemberDeleteParams {
  /**
   * Account identifier tag.
   */
  account_id: string;
}

export interface MemberGetParams {
  /**
   * Account identifier tag.
   */
  account_id: string;
}

export declare namespace Members {
  export {
    type Status as Status,
    type MemberDeleteResponse as MemberDeleteResponse,
    type MemberCreateParams as MemberCreateParams,
    type MemberUpdateParams as MemberUpdateParams,
    type MemberListParams as MemberListParams,
    type MemberDeleteParams as MemberDeleteParams,
    type MemberGetParams as MemberGetParams,
  };
}

export { MembersV4PagePaginationArray };
