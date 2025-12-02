import type { SamlIdpSlug } from '@clerk/types';
import type { SamlConnection } from '../resources';
import { AbstractAPI } from './AbstractApi';
type SamlConnectionListParams = {
    limit?: number;
    offset?: number;
};
type CreateSamlConnectionParams = {
    name: string;
    provider: SamlIdpSlug;
    domain: string;
    organizationId?: string;
    idpEntityId?: string;
    idpSsoUrl?: string;
    idpCertificate?: string;
    idpMetadataUrl?: string;
    idpMetadata?: string;
    attributeMapping?: {
        emailAddress?: string;
        firstName?: string;
        lastName?: string;
        userId?: string;
    };
};
type UpdateSamlConnectionParams = {
    name?: string;
    provider?: SamlIdpSlug;
    domain?: string;
    organizationId?: string;
    idpEntityId?: string;
    idpSsoUrl?: string;
    idpCertificate?: string;
    idpMetadataUrl?: string;
    idpMetadata?: string;
    attributeMapping?: {
        emailAddress?: string;
        firstName?: string;
        lastName?: string;
        userId?: string;
    };
    active?: boolean;
    syncUserAttributes?: boolean;
    allowSubdomains?: boolean;
    allowIdpInitiated?: boolean;
};
export declare class SamlConnectionAPI extends AbstractAPI {
    getSamlConnectionList(params?: SamlConnectionListParams): Promise<SamlConnection[]>;
    createSamlConnection(params: CreateSamlConnectionParams): Promise<SamlConnection>;
    getSamlConnection(samlConnectionId: string): Promise<SamlConnection>;
    updateSamlConnection(samlConnectionId: string, params?: UpdateSamlConnectionParams): Promise<SamlConnection>;
    deleteSamlConnection(samlConnectionId: string): Promise<SamlConnection>;
}
export {};
//# sourceMappingURL=SamlConnectionApi.d.ts.map