import { RoleResponse } from '../../roles/interfaces/';
import { DirectoryGroup, DirectoryGroupResponse } from './directory-group.interface';
export type DefaultCustomAttributes = Record<string, unknown>;
export interface DirectoryUser<TCustomAttributes extends object = DefaultCustomAttributes, TRawAttributes = any> {
    object: 'directory_user';
    id: string;
    directoryId: string;
    organizationId: string | null;
    rawAttributes: TRawAttributes;
    customAttributes: TCustomAttributes;
    idpId: string;
    firstName: string | null;
    email: string | null;
    /** @deprecated Will be removed in a future major version.
     * Enable the `emails` custom attribute in dashboard and pull from customAttributes instead.
     * See https://workos.com/docs/directory-sync/attributes/custom-attributes/auto-mapped-attributes for details.
     */
    emails: {
        type?: string;
        value?: string;
        primary?: boolean;
    }[];
    /** @deprecated Will be removed in a future major version.
     * Enable the `username` custom attribute in dashboard and pull from customAttributes instead.
     * See https://workos.com/docs/directory-sync/attributes/custom-attributes/auto-mapped-attributes for details.
     */
    username: string | null;
    lastName: string | null;
    /** @deprecated Will be removed in a future major version.
     * Enable the `job_title` custom attribute in dashboard and pull from customAttributes instead.
     * See https://workos.com/docs/directory-sync/attributes/custom-attributes/auto-mapped-attributes for details.
     */
    jobTitle: string | null;
    state: 'active' | 'inactive';
    role?: RoleResponse;
    createdAt: string;
    updatedAt: string;
}
export interface DirectoryUserResponse<TCustomAttributes extends object = DefaultCustomAttributes, TRawAttributes = any> {
    object: 'directory_user';
    id: string;
    directory_id: string;
    organization_id: string | null;
    raw_attributes: TRawAttributes;
    custom_attributes: TCustomAttributes;
    idp_id: string;
    first_name: string | null;
    email: string | null;
    /** @deprecated Will be removed in a future major version.
     * Enable the `emails` custom attribute in dashboard and pull from customAttributes instead.
     * See https://workos.com/docs/directory-sync/attributes/custom-attributes/auto-mapped-attributes for details.
     */
    emails: {
        type?: string;
        value?: string;
        primary?: boolean;
    }[];
    /** @deprecated Will be removed in a future major version.
     * Enable the `username` custom attribute in dashboard and pull from customAttributes instead.
     * See https://workos.com/docs/directory-sync/attributes/custom-attributes/auto-mapped-attributes for details.
     */
    username: string | null;
    last_name: string | null;
    /** @deprecated Will be removed in a future major version.
     * Enable the `job_title` custom attribute in dashboard and pull from customAttributes instead.
     * See https://workos.com/docs/directory-sync/attributes/custom-attributes/auto-mapped-attributes for details.
     */
    job_title: string | null;
    state: 'active' | 'inactive';
    role?: RoleResponse;
    created_at: string;
    updated_at: string;
}
export interface DirectoryUserWithGroups<TCustomAttributes extends object = DefaultCustomAttributes> extends DirectoryUser<TCustomAttributes> {
    groups: DirectoryGroup[];
}
export interface DirectoryUserWithGroupsResponse<TCustomAttributes extends object = DefaultCustomAttributes> extends DirectoryUserResponse<TCustomAttributes> {
    groups: DirectoryGroupResponse[];
}
