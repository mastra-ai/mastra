import { OrganizationDomain, OrganizationDomainResponse } from '../../organization-domains/interfaces/organization-domain.interface';
export interface Organization {
    object: 'organization';
    id: string;
    name: string;
    allowProfilesOutsideOrganization: boolean;
    domains: OrganizationDomain[];
    stripeCustomerId?: string;
    createdAt: string;
    updatedAt: string;
    externalId: string | null;
    metadata: Record<string, string>;
}
export interface OrganizationResponse {
    object: 'organization';
    id: string;
    name: string;
    allow_profiles_outside_organization: boolean;
    domains: OrganizationDomainResponse[];
    stripe_customer_id?: string;
    created_at: string;
    updated_at: string;
    external_id?: string | null;
    metadata?: Record<string, string>;
}
