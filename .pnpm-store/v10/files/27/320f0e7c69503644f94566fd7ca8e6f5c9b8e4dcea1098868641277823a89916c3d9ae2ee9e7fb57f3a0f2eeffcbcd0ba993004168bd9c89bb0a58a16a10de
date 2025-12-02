import { PostOptions } from '../../common/interfaces';
import { DomainData } from './domain-data.interface';
export interface CreateOrganizationOptions {
    name: string;
    domainData?: DomainData[];
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
export interface SerializedCreateOrganizationOptions {
    name: string;
    domain_data?: DomainData[];
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
export interface CreateOrganizationRequestOptions extends Pick<PostOptions, 'idempotencyKey'> {
}
