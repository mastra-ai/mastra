import { DomainData } from './domain-data.interface';
export interface UpdateOrganizationOptions {
    organization: string;
    name?: string;
    domainData?: DomainData[];
    stripeCustomerId?: string | null;
    externalId?: string | null;
    metadata?: Record<string, string>;
    /**
     * @deprecated If you need to allow sign-ins from any email domain, contact support@workos.com.
     */
    allowProfilesOutsideOrganization?: boolean;
    /**
     * @deprecated Use `domain_data` instead.
     */
    domains?: string[];
}
export interface SerializedUpdateOrganizationOptions {
    name?: string;
    domain_data?: DomainData[];
    stripe_customer_id?: string | null;
    external_id?: string | null;
    metadata?: Record<string, string>;
    /**
     * @deprecated If you need to allow sign-ins from any email domain, contact support@workos.com.
     */
    allow_profiles_outside_organization?: boolean;
    /**
     * @deprecated Use `domain_data` instead.
     */
    domains?: string[];
}
