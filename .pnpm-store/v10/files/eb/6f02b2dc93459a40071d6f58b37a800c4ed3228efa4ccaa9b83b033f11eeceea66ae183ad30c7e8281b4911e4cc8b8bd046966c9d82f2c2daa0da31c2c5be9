import { AutoPaginatable } from '../common/utils/pagination';
import { WorkOS } from '../workos';
import { CreateOrganizationOptions, CreateOrganizationRequestOptions, ListOrganizationsOptions, Organization, UpdateOrganizationOptions } from './interfaces';
import { FeatureFlag } from '../feature-flags/interfaces/feature-flag.interface';
import { RoleList } from '../roles/interfaces';
import { ListOrganizationRolesOptions } from './interfaces/list-organization-roles-options.interface';
import { ListOrganizationFeatureFlagsOptions } from './interfaces/list-organization-feature-flags-options.interface';
export declare class Organizations {
    private readonly workos;
    constructor(workos: WorkOS);
    listOrganizations(options?: ListOrganizationsOptions): Promise<AutoPaginatable<Organization>>;
    createOrganization(payload: CreateOrganizationOptions, requestOptions?: CreateOrganizationRequestOptions): Promise<Organization>;
    deleteOrganization(id: string): Promise<void>;
    getOrganization(id: string): Promise<Organization>;
    getOrganizationByExternalId(externalId: string): Promise<Organization>;
    updateOrganization(options: UpdateOrganizationOptions): Promise<Organization>;
    listOrganizationRoles(options: ListOrganizationRolesOptions): Promise<RoleList>;
    listOrganizationFeatureFlags(options: ListOrganizationFeatureFlagsOptions): Promise<AutoPaginatable<FeatureFlag>>;
}
