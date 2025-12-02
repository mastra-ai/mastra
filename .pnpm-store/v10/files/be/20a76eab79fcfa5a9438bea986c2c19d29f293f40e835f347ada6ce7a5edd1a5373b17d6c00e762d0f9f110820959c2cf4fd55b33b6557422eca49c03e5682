import { WorkOS } from '../workos';
import { CreateOrganizationDomainOptions, OrganizationDomain } from './interfaces';
export declare class OrganizationDomains {
    private readonly workos;
    constructor(workos: WorkOS);
    get(id: string): Promise<OrganizationDomain>;
    verify(id: string): Promise<OrganizationDomain>;
    create(payload: CreateOrganizationDomainOptions): Promise<OrganizationDomain>;
    delete(id: string): Promise<void>;
}
