import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as Shared from "../shared.js";
import { MembersV4PagePaginationArray } from "../shared.js";
import { type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class Members extends APIResource {
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
    create(params: MemberCreateParams, options?: Core.RequestOptions): Core.APIPromise<Shared.Member>;
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
    update(memberId: string, params: MemberUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Shared.Member>;
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
    list(params: MemberListParams, options?: Core.RequestOptions): Core.PagePromise<MembersV4PagePaginationArray, Shared.Member>;
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
    delete(memberId: string, params: MemberDeleteParams, options?: Core.RequestOptions): Core.APIPromise<MemberDeleteResponse | null>;
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
    get(memberId: string, params: MemberGetParams, options?: Core.RequestOptions): Core.APIPromise<Shared.Member>;
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
export type MemberCreateParams = MemberCreateParams.IAMCreateMemberWithRoles | MemberCreateParams.IAMCreateMemberWithPolicies;
export declare namespace MemberCreateParams {
    interface IAMCreateMemberWithRoles {
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
    interface IAMCreateMemberWithPolicies {
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
    namespace IAMCreateMemberWithPolicies {
        interface Policy {
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
        namespace Policy {
            /**
             * A group of permissions.
             */
            interface PermissionGroup {
                /**
                 * Identifier of the group.
                 */
                id: string;
            }
            /**
             * A group of scoped resources.
             */
            interface ResourceGroup {
                /**
                 * Identifier of the group.
                 */
                id: string;
            }
        }
    }
}
export type MemberUpdateParams = MemberUpdateParams.IAMUpdateMemberWithRoles | MemberUpdateParams.IAMUpdateMemberWithPolicies;
export declare namespace MemberUpdateParams {
    interface IAMUpdateMemberWithRoles {
        /**
         * Path param: Account identifier tag.
         */
        account_id: string;
        /**
         * Body param: Roles assigned to this member.
         */
        roles?: Array<Shared.RoleParam>;
    }
    interface IAMUpdateMemberWithPolicies {
        /**
         * Path param: Account identifier tag.
         */
        account_id: string;
        /**
         * Body param: Array of policies associated with this member.
         */
        policies: Array<IAMUpdateMemberWithPolicies.Policy>;
    }
    namespace IAMUpdateMemberWithPolicies {
        interface Policy {
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
        namespace Policy {
            /**
             * A group of permissions.
             */
            interface PermissionGroup {
                /**
                 * Identifier of the group.
                 */
                id: string;
            }
            /**
             * A group of scoped resources.
             */
            interface ResourceGroup {
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
    export { type Status as Status, type MemberDeleteResponse as MemberDeleteResponse, type MemberCreateParams as MemberCreateParams, type MemberUpdateParams as MemberUpdateParams, type MemberListParams as MemberListParams, type MemberDeleteParams as MemberDeleteParams, type MemberGetParams as MemberGetParams, };
}
export { MembersV4PagePaginationArray };
//# sourceMappingURL=members.d.ts.map