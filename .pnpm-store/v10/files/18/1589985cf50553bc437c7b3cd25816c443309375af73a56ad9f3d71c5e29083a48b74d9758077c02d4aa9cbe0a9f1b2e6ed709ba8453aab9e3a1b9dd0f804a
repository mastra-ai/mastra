import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as Shared from "../shared.js";
import * as MembersAPI from "../accounts/members.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class Organizations extends APIResource {
    /**
     * Lists organizations the user is associated with.
     *
     * @deprecated
     */
    list(query?: OrganizationListParams, options?: Core.RequestOptions): Core.PagePromise<OrganizationsV4PagePaginationArray, Organization>;
    list(options?: Core.RequestOptions): Core.PagePromise<OrganizationsV4PagePaginationArray, Organization>;
    /**
     * Removes association to an organization.
     *
     * @deprecated
     */
    delete(organizationId: string, options?: Core.RequestOptions): Core.APIPromise<OrganizationDeleteResponse>;
    /**
     * Gets a specific organization the user is associated with.
     *
     * @deprecated
     */
    get(organizationId: string, options?: Core.RequestOptions): Core.APIPromise<OrganizationGetResponse>;
}
export declare class OrganizationsV4PagePaginationArray extends V4PagePaginationArray<Organization> {
}
export interface Organization {
    /**
     * Identifier
     */
    id?: string;
    /**
     * Organization name.
     */
    name?: string;
    /**
     * Access permissions for this User.
     */
    permissions?: Array<Shared.Permission>;
    /**
     * List of roles that a user has within an organization.
     */
    roles?: Array<string>;
    /**
     * Whether the user is a member of the organization or has an invitation pending.
     */
    status?: MembersAPI.Status;
}
export interface OrganizationDeleteResponse {
    /**
     * Identifier
     */
    id?: string;
}
export type OrganizationGetResponse = unknown;
export interface OrganizationListParams extends V4PagePaginationArrayParams {
    /**
     * Direction to order organizations.
     */
    direction?: 'asc' | 'desc';
    /**
     * Whether to match all search requirements or at least one (any).
     */
    match?: 'any' | 'all';
    /**
     * Organization name.
     */
    name?: string;
    /**
     * Field to order organizations by.
     */
    order?: 'id' | 'name' | 'status';
    /**
     * Whether the user is a member of the organization or has an inivitation pending.
     */
    status?: 'member' | 'invited';
}
export declare namespace Organizations {
    export { type Organization as Organization, type OrganizationDeleteResponse as OrganizationDeleteResponse, type OrganizationGetResponse as OrganizationGetResponse, OrganizationsV4PagePaginationArray as OrganizationsV4PagePaginationArray, type OrganizationListParams as OrganizationListParams, };
}
//# sourceMappingURL=organizations.d.ts.map