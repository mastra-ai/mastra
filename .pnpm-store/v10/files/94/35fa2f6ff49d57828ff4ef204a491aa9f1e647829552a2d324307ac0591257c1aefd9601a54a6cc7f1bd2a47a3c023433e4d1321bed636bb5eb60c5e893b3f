import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as MembersAPI from "./members.js";
import { MemberCreateParams, MemberCreateResponse, MemberDeleteParams, MemberDeleteResponse, MemberListParams, MemberListResponse, MemberListResponsesV4PagePaginationArray, MemberUpdateParams, MemberUpdateResponse, MemberUpdateResponsesSinglePage, Members } from "./members.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../pagination.js";
export declare class UserGroups extends APIResource {
    members: MembersAPI.Members;
    /**
     * Create a new user group under the specified account.
     *
     * @example
     * ```ts
     * const userGroup = await client.iam.userGroups.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'My New User Group',
     *   policies: [
     *     {
     *       access: 'allow',
     *       permission_groups: [
     *         { id: 'c8fed203ed3043cba015a93ad1616f1f' },
     *         { id: '82e64a83756745bbbb1c9c2701bf816b' },
     *       ],
     *       resource_groups: [
     *         { id: '6d7f2f5f5b1d4a0e9081fdc98d432fd1' },
     *       ],
     *     },
     *   ],
     * });
     * ```
     */
    create(params: UserGroupCreateParams, options?: Core.RequestOptions): Core.APIPromise<UserGroupCreateResponse>;
    /**
     * Modify an existing user group.
     *
     * @example
     * ```ts
     * const userGroup = await client.iam.userGroups.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(userGroupId: string, params: UserGroupUpdateParams, options?: Core.RequestOptions): Core.APIPromise<UserGroupUpdateResponse>;
    /**
     * List all the user groups for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const userGroupListResponse of client.iam.userGroups.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: UserGroupListParams, options?: Core.RequestOptions): Core.PagePromise<UserGroupListResponsesV4PagePaginationArray, UserGroupListResponse>;
    /**
     * Remove a user group from an account.
     *
     * @example
     * ```ts
     * const userGroup = await client.iam.userGroups.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(userGroupId: string, params: UserGroupDeleteParams, options?: Core.RequestOptions): Core.APIPromise<UserGroupDeleteResponse | null>;
    /**
     * Get information about a specific user group in an account.
     *
     * @example
     * ```ts
     * const userGroup = await client.iam.userGroups.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(userGroupId: string, params: UserGroupGetParams, options?: Core.RequestOptions): Core.APIPromise<UserGroupGetResponse>;
}
export declare class UserGroupListResponsesV4PagePaginationArray extends V4PagePaginationArray<UserGroupListResponse> {
}
/**
 * A group of policies resources.
 */
export interface UserGroupCreateResponse {
    /**
     * User Group identifier tag.
     */
    id: string;
    /**
     * Timestamp for the creation of the user group
     */
    created_on: string;
    /**
     * Last time the user group was modified.
     */
    modified_on: string;
    /**
     * Name of the user group.
     */
    name: string;
    /**
     * Policies attached to the User group
     */
    policies?: Array<UserGroupCreateResponse.Policy>;
}
export declare namespace UserGroupCreateResponse {
    /**
     * Policy
     */
    interface Policy {
        /**
         * Policy identifier.
         */
        id?: string;
        /**
         * Allow or deny operations against the resources.
         */
        access?: 'allow' | 'deny';
        /**
         * A set of permission groups that are specified to the policy.
         */
        permission_groups?: Array<Policy.PermissionGroup>;
        /**
         * A list of resource groups that the policy applies to.
         */
        resource_groups?: Array<Policy.ResourceGroup>;
    }
    namespace Policy {
        /**
         * A named group of permissions that map to a group of operations against
         * resources.
         */
        interface PermissionGroup {
            /**
             * Identifier of the permission group.
             */
            id: string;
            /**
             * Attributes associated to the permission group.
             */
            meta?: PermissionGroup.Meta;
            /**
             * Name of the permission group.
             */
            name?: string;
        }
        namespace PermissionGroup {
            /**
             * Attributes associated to the permission group.
             */
            interface Meta {
                key?: string;
                value?: string;
            }
        }
        /**
         * A group of scoped resources.
         */
        interface ResourceGroup {
            /**
             * Identifier of the resource group.
             */
            id: string;
            /**
             * The scope associated to the resource group
             */
            scope: Array<ResourceGroup.Scope>;
            /**
             * Attributes associated to the resource group.
             */
            meta?: ResourceGroup.Meta;
            /**
             * Name of the resource group.
             */
            name?: string;
        }
        namespace ResourceGroup {
            /**
             * A scope is a combination of scope objects which provides additional context.
             */
            interface Scope {
                /**
                 * This is a combination of pre-defined resource name and identifier (like Account
                 * ID etc.)
                 */
                key: string;
                /**
                 * A list of scope objects for additional context.
                 */
                objects: Array<Scope.Object>;
            }
            namespace Scope {
                /**
                 * A scope object represents any resource that can have actions applied against
                 * invite.
                 */
                interface Object {
                    /**
                     * This is a combination of pre-defined resource name and identifier (like Zone ID
                     * etc.)
                     */
                    key: string;
                }
            }
            /**
             * Attributes associated to the resource group.
             */
            interface Meta {
                key?: string;
                value?: string;
            }
        }
    }
}
/**
 * A group of policies resources.
 */
export interface UserGroupUpdateResponse {
    /**
     * User Group identifier tag.
     */
    id: string;
    /**
     * Timestamp for the creation of the user group
     */
    created_on: string;
    /**
     * Last time the user group was modified.
     */
    modified_on: string;
    /**
     * Name of the user group.
     */
    name: string;
    /**
     * Policies attached to the User group
     */
    policies?: Array<UserGroupUpdateResponse.Policy>;
}
export declare namespace UserGroupUpdateResponse {
    /**
     * Policy
     */
    interface Policy {
        /**
         * Policy identifier.
         */
        id?: string;
        /**
         * Allow or deny operations against the resources.
         */
        access?: 'allow' | 'deny';
        /**
         * A set of permission groups that are specified to the policy.
         */
        permission_groups?: Array<Policy.PermissionGroup>;
        /**
         * A list of resource groups that the policy applies to.
         */
        resource_groups?: Array<Policy.ResourceGroup>;
    }
    namespace Policy {
        /**
         * A named group of permissions that map to a group of operations against
         * resources.
         */
        interface PermissionGroup {
            /**
             * Identifier of the permission group.
             */
            id: string;
            /**
             * Attributes associated to the permission group.
             */
            meta?: PermissionGroup.Meta;
            /**
             * Name of the permission group.
             */
            name?: string;
        }
        namespace PermissionGroup {
            /**
             * Attributes associated to the permission group.
             */
            interface Meta {
                key?: string;
                value?: string;
            }
        }
        /**
         * A group of scoped resources.
         */
        interface ResourceGroup {
            /**
             * Identifier of the resource group.
             */
            id: string;
            /**
             * The scope associated to the resource group
             */
            scope: Array<ResourceGroup.Scope>;
            /**
             * Attributes associated to the resource group.
             */
            meta?: ResourceGroup.Meta;
            /**
             * Name of the resource group.
             */
            name?: string;
        }
        namespace ResourceGroup {
            /**
             * A scope is a combination of scope objects which provides additional context.
             */
            interface Scope {
                /**
                 * This is a combination of pre-defined resource name and identifier (like Account
                 * ID etc.)
                 */
                key: string;
                /**
                 * A list of scope objects for additional context.
                 */
                objects: Array<Scope.Object>;
            }
            namespace Scope {
                /**
                 * A scope object represents any resource that can have actions applied against
                 * invite.
                 */
                interface Object {
                    /**
                     * This is a combination of pre-defined resource name and identifier (like Zone ID
                     * etc.)
                     */
                    key: string;
                }
            }
            /**
             * Attributes associated to the resource group.
             */
            interface Meta {
                key?: string;
                value?: string;
            }
        }
    }
}
/**
 * A group of policies resources.
 */
export interface UserGroupListResponse {
    /**
     * User Group identifier tag.
     */
    id: string;
    /**
     * Timestamp for the creation of the user group
     */
    created_on: string;
    /**
     * Last time the user group was modified.
     */
    modified_on: string;
    /**
     * Name of the user group.
     */
    name: string;
    /**
     * Policies attached to the User group
     */
    policies?: Array<UserGroupListResponse.Policy>;
}
export declare namespace UserGroupListResponse {
    /**
     * Policy
     */
    interface Policy {
        /**
         * Policy identifier.
         */
        id?: string;
        /**
         * Allow or deny operations against the resources.
         */
        access?: 'allow' | 'deny';
        /**
         * A set of permission groups that are specified to the policy.
         */
        permission_groups?: Array<Policy.PermissionGroup>;
        /**
         * A list of resource groups that the policy applies to.
         */
        resource_groups?: Array<Policy.ResourceGroup>;
    }
    namespace Policy {
        /**
         * A named group of permissions that map to a group of operations against
         * resources.
         */
        interface PermissionGroup {
            /**
             * Identifier of the permission group.
             */
            id: string;
            /**
             * Attributes associated to the permission group.
             */
            meta?: PermissionGroup.Meta;
            /**
             * Name of the permission group.
             */
            name?: string;
        }
        namespace PermissionGroup {
            /**
             * Attributes associated to the permission group.
             */
            interface Meta {
                key?: string;
                value?: string;
            }
        }
        /**
         * A group of scoped resources.
         */
        interface ResourceGroup {
            /**
             * Identifier of the resource group.
             */
            id: string;
            /**
             * The scope associated to the resource group
             */
            scope: Array<ResourceGroup.Scope>;
            /**
             * Attributes associated to the resource group.
             */
            meta?: ResourceGroup.Meta;
            /**
             * Name of the resource group.
             */
            name?: string;
        }
        namespace ResourceGroup {
            /**
             * A scope is a combination of scope objects which provides additional context.
             */
            interface Scope {
                /**
                 * This is a combination of pre-defined resource name and identifier (like Account
                 * ID etc.)
                 */
                key: string;
                /**
                 * A list of scope objects for additional context.
                 */
                objects: Array<Scope.Object>;
            }
            namespace Scope {
                /**
                 * A scope object represents any resource that can have actions applied against
                 * invite.
                 */
                interface Object {
                    /**
                     * This is a combination of pre-defined resource name and identifier (like Zone ID
                     * etc.)
                     */
                    key: string;
                }
            }
            /**
             * Attributes associated to the resource group.
             */
            interface Meta {
                key?: string;
                value?: string;
            }
        }
    }
}
export interface UserGroupDeleteResponse {
    /**
     * Identifier
     */
    id: string;
}
/**
 * A group of policies resources.
 */
export interface UserGroupGetResponse {
    /**
     * User Group identifier tag.
     */
    id: string;
    /**
     * Timestamp for the creation of the user group
     */
    created_on: string;
    /**
     * Last time the user group was modified.
     */
    modified_on: string;
    /**
     * Name of the user group.
     */
    name: string;
    /**
     * Policies attached to the User group
     */
    policies?: Array<UserGroupGetResponse.Policy>;
}
export declare namespace UserGroupGetResponse {
    /**
     * Policy
     */
    interface Policy {
        /**
         * Policy identifier.
         */
        id?: string;
        /**
         * Allow or deny operations against the resources.
         */
        access?: 'allow' | 'deny';
        /**
         * A set of permission groups that are specified to the policy.
         */
        permission_groups?: Array<Policy.PermissionGroup>;
        /**
         * A list of resource groups that the policy applies to.
         */
        resource_groups?: Array<Policy.ResourceGroup>;
    }
    namespace Policy {
        /**
         * A named group of permissions that map to a group of operations against
         * resources.
         */
        interface PermissionGroup {
            /**
             * Identifier of the permission group.
             */
            id: string;
            /**
             * Attributes associated to the permission group.
             */
            meta?: PermissionGroup.Meta;
            /**
             * Name of the permission group.
             */
            name?: string;
        }
        namespace PermissionGroup {
            /**
             * Attributes associated to the permission group.
             */
            interface Meta {
                key?: string;
                value?: string;
            }
        }
        /**
         * A group of scoped resources.
         */
        interface ResourceGroup {
            /**
             * Identifier of the resource group.
             */
            id: string;
            /**
             * The scope associated to the resource group
             */
            scope: Array<ResourceGroup.Scope>;
            /**
             * Attributes associated to the resource group.
             */
            meta?: ResourceGroup.Meta;
            /**
             * Name of the resource group.
             */
            name?: string;
        }
        namespace ResourceGroup {
            /**
             * A scope is a combination of scope objects which provides additional context.
             */
            interface Scope {
                /**
                 * This is a combination of pre-defined resource name and identifier (like Account
                 * ID etc.)
                 */
                key: string;
                /**
                 * A list of scope objects for additional context.
                 */
                objects: Array<Scope.Object>;
            }
            namespace Scope {
                /**
                 * A scope object represents any resource that can have actions applied against
                 * invite.
                 */
                interface Object {
                    /**
                     * This is a combination of pre-defined resource name and identifier (like Zone ID
                     * etc.)
                     */
                    key: string;
                }
            }
            /**
             * Attributes associated to the resource group.
             */
            interface Meta {
                key?: string;
                value?: string;
            }
        }
    }
}
export interface UserGroupCreateParams {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;
    /**
     * Body param: Name of the User group.
     */
    name: string;
    /**
     * Body param: Policies attached to the User group
     */
    policies: Array<UserGroupCreateParams.Policy>;
}
export declare namespace UserGroupCreateParams {
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
         * A set of resource groups that are specified to the policy.
         */
        resource_groups: Array<Policy.ResourceGroup>;
    }
    namespace Policy {
        /**
         * A named group of permissions that map to a group of operations against
         * resources.
         */
        interface PermissionGroup {
            /**
             * Permission Group identifier tag.
             */
            id: string;
        }
        /**
         * A group of scoped resources.
         */
        interface ResourceGroup {
            /**
             * Resource Group identifier tag.
             */
            id: string;
        }
    }
}
export interface UserGroupUpdateParams {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;
    /**
     * Body param: Name of the User group.
     */
    name?: string;
    /**
     * Body param: Policies attached to the User group
     */
    policies?: Array<UserGroupUpdateParams.Policy>;
}
export declare namespace UserGroupUpdateParams {
    interface Policy {
        /**
         * Policy identifier.
         */
        id: string;
        /**
         * Allow or deny operations against the resources.
         */
        access: 'allow' | 'deny';
        /**
         * A set of permission groups that are specified to the policy.
         */
        permission_groups: Array<Policy.PermissionGroup>;
        /**
         * A set of resource groups that are specified to the policy.
         */
        resource_groups: Array<Policy.ResourceGroup>;
    }
    namespace Policy {
        /**
         * A named group of permissions that map to a group of operations against
         * resources.
         */
        interface PermissionGroup {
            /**
             * Permission Group identifier tag.
             */
            id: string;
        }
        /**
         * A group of scoped resources.
         */
        interface ResourceGroup {
            /**
             * Resource Group identifier tag.
             */
            id: string;
        }
    }
}
export interface UserGroupListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;
    /**
     * Query param: ID of the user group to be fetched.
     */
    id?: string;
    /**
     * Query param: The sort order of returned user groups by name. Default sort order
     * is ascending. To switch to descending, set this parameter to "desc"
     */
    direction?: string;
    /**
     * Query param: A string used for searching for user groups containing that
     * substring.
     */
    fuzzyName?: string;
    /**
     * Query param: Name of the user group to be fetched.
     */
    name?: string;
}
export interface UserGroupDeleteParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export interface UserGroupGetParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export declare namespace UserGroups {
    export { type UserGroupCreateResponse as UserGroupCreateResponse, type UserGroupUpdateResponse as UserGroupUpdateResponse, type UserGroupListResponse as UserGroupListResponse, type UserGroupDeleteResponse as UserGroupDeleteResponse, type UserGroupGetResponse as UserGroupGetResponse, UserGroupListResponsesV4PagePaginationArray as UserGroupListResponsesV4PagePaginationArray, type UserGroupCreateParams as UserGroupCreateParams, type UserGroupUpdateParams as UserGroupUpdateParams, type UserGroupListParams as UserGroupListParams, type UserGroupDeleteParams as UserGroupDeleteParams, type UserGroupGetParams as UserGroupGetParams, };
    export { Members as Members, type MemberCreateResponse as MemberCreateResponse, type MemberUpdateResponse as MemberUpdateResponse, type MemberListResponse as MemberListResponse, type MemberDeleteResponse as MemberDeleteResponse, MemberUpdateResponsesSinglePage as MemberUpdateResponsesSinglePage, MemberListResponsesV4PagePaginationArray as MemberListResponsesV4PagePaginationArray, type MemberCreateParams as MemberCreateParams, type MemberUpdateParams as MemberUpdateParams, type MemberListParams as MemberListParams, type MemberDeleteParams as MemberDeleteParams, };
}
//# sourceMappingURL=user-groups.d.ts.map