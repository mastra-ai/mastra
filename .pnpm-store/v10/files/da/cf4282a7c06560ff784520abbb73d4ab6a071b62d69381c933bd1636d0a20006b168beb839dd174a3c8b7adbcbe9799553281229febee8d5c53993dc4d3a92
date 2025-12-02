import { APIResource } from "../resource.js";
import * as Core from "../core.js";
import * as Shared from "./shared.js";
import * as AccountsAPI from "./accounts/accounts.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../pagination.js";
export declare class Memberships extends APIResource {
    /**
     * Accept or reject this account invitation.
     *
     * @example
     * ```ts
     * const membership = await client.memberships.update(
     *   '4536bcfad5faccb111b47003c79917fa',
     *   { status: 'accepted' },
     * );
     * ```
     */
    update(membershipId: string, body: MembershipUpdateParams, options?: Core.RequestOptions): Core.APIPromise<MembershipUpdateResponse>;
    /**
     * List memberships of accounts the user can access.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const membership of client.memberships.list()) {
     *   // ...
     * }
     * ```
     */
    list(query?: MembershipListParams, options?: Core.RequestOptions): Core.PagePromise<MembershipsV4PagePaginationArray, Membership>;
    list(options?: Core.RequestOptions): Core.PagePromise<MembershipsV4PagePaginationArray, Membership>;
    /**
     * Remove the associated member from an account.
     *
     * @example
     * ```ts
     * const membership = await client.memberships.delete(
     *   '4536bcfad5faccb111b47003c79917fa',
     * );
     * ```
     */
    delete(membershipId: string, options?: Core.RequestOptions): Core.APIPromise<MembershipDeleteResponse>;
    /**
     * Get a specific membership.
     *
     * @example
     * ```ts
     * const membership = await client.memberships.get(
     *   '4536bcfad5faccb111b47003c79917fa',
     * );
     * ```
     */
    get(membershipId: string, options?: Core.RequestOptions): Core.APIPromise<MembershipGetResponse>;
}
export declare class MembershipsV4PagePaginationArray extends V4PagePaginationArray<Membership> {
}
export interface Membership {
    /**
     * Membership identifier tag.
     */
    id?: string;
    account?: AccountsAPI.Account;
    /**
     * Enterprise only. Indicates whether or not API access is enabled specifically for
     * this user on a given account.
     */
    api_access_enabled?: boolean | null;
    /**
     * All access permissions for the user at the account.
     */
    permissions?: Membership.Permissions;
    /**
     * List of role names the membership has for this account.
     */
    roles?: Array<string>;
    /**
     * Status of this membership.
     */
    status?: 'accepted' | 'pending' | 'rejected';
}
export declare namespace Membership {
    /**
     * All access permissions for the user at the account.
     */
    interface Permissions {
        analytics?: Shared.PermissionGrant;
        billing?: Shared.PermissionGrant;
        cache_purge?: Shared.PermissionGrant;
        dns?: Shared.PermissionGrant;
        dns_records?: Shared.PermissionGrant;
        lb?: Shared.PermissionGrant;
        logs?: Shared.PermissionGrant;
        organization?: Shared.PermissionGrant;
        ssl?: Shared.PermissionGrant;
        waf?: Shared.PermissionGrant;
        zone_settings?: Shared.PermissionGrant;
        zones?: Shared.PermissionGrant;
    }
}
export interface MembershipUpdateResponse {
    /**
     * Membership identifier tag.
     */
    id?: string;
    account?: AccountsAPI.Account;
    /**
     * Enterprise only. Indicates whether or not API access is enabled specifically for
     * this user on a given account.
     */
    api_access_enabled?: boolean | null;
    /**
     * All access permissions for the user at the account.
     */
    permissions?: MembershipUpdateResponse.Permissions;
    /**
     * Access policy for the membership
     */
    policies?: Array<MembershipUpdateResponse.Policy>;
    /**
     * List of role names the membership has for this account.
     */
    roles?: Array<string>;
    /**
     * Status of this membership.
     */
    status?: 'accepted' | 'pending' | 'rejected';
}
export declare namespace MembershipUpdateResponse {
    /**
     * All access permissions for the user at the account.
     */
    interface Permissions {
        analytics?: Shared.PermissionGrant;
        billing?: Shared.PermissionGrant;
        cache_purge?: Shared.PermissionGrant;
        dns?: Shared.PermissionGrant;
        dns_records?: Shared.PermissionGrant;
        lb?: Shared.PermissionGrant;
        logs?: Shared.PermissionGrant;
        organization?: Shared.PermissionGrant;
        ssl?: Shared.PermissionGrant;
        waf?: Shared.PermissionGrant;
        zone_settings?: Shared.PermissionGrant;
        zones?: Shared.PermissionGrant;
    }
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
export interface MembershipDeleteResponse {
    /**
     * Membership identifier tag.
     */
    id?: string;
}
export interface MembershipGetResponse {
    /**
     * Membership identifier tag.
     */
    id?: string;
    account?: AccountsAPI.Account;
    /**
     * Enterprise only. Indicates whether or not API access is enabled specifically for
     * this user on a given account.
     */
    api_access_enabled?: boolean | null;
    /**
     * All access permissions for the user at the account.
     */
    permissions?: MembershipGetResponse.Permissions;
    /**
     * Access policy for the membership
     */
    policies?: Array<MembershipGetResponse.Policy>;
    /**
     * List of role names the membership has for this account.
     */
    roles?: Array<string>;
    /**
     * Status of this membership.
     */
    status?: 'accepted' | 'pending' | 'rejected';
}
export declare namespace MembershipGetResponse {
    /**
     * All access permissions for the user at the account.
     */
    interface Permissions {
        analytics?: Shared.PermissionGrant;
        billing?: Shared.PermissionGrant;
        cache_purge?: Shared.PermissionGrant;
        dns?: Shared.PermissionGrant;
        dns_records?: Shared.PermissionGrant;
        lb?: Shared.PermissionGrant;
        logs?: Shared.PermissionGrant;
        organization?: Shared.PermissionGrant;
        ssl?: Shared.PermissionGrant;
        waf?: Shared.PermissionGrant;
        zone_settings?: Shared.PermissionGrant;
        zones?: Shared.PermissionGrant;
    }
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
export interface MembershipUpdateParams {
    /**
     * Whether to accept or reject this account invitation.
     */
    status: 'accepted' | 'rejected';
}
export interface MembershipListParams extends V4PagePaginationArrayParams {
    account?: MembershipListParams.Account;
    /**
     * Direction to order memberships.
     */
    direction?: 'asc' | 'desc';
    /**
     * Account name
     */
    name?: string;
    /**
     * Field to order memberships by.
     */
    order?: 'id' | 'account.name' | 'status';
    /**
     * Status of this membership.
     */
    status?: 'accepted' | 'pending' | 'rejected';
}
export declare namespace MembershipListParams {
    interface Account {
        /**
         * Account name
         */
        name?: string;
    }
}
export declare namespace Memberships {
    export { type Membership as Membership, type MembershipUpdateResponse as MembershipUpdateResponse, type MembershipDeleteResponse as MembershipDeleteResponse, type MembershipGetResponse as MembershipGetResponse, MembershipsV4PagePaginationArray as MembershipsV4PagePaginationArray, type MembershipUpdateParams as MembershipUpdateParams, type MembershipListParams as MembershipListParams, };
}
//# sourceMappingURL=memberships.d.ts.map