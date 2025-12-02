import type { AttributeMappingJSON, SamlAccountConnectionJSON, SamlConnectionJSON } from './JSON';
export declare class SamlConnection {
    readonly id: string;
    readonly name: string;
    readonly domain: string;
    readonly organizationId: string | null;
    readonly idpEntityId: string | null;
    readonly idpSsoUrl: string | null;
    readonly idpCertificate: string | null;
    readonly idpMetadataUrl: string | null;
    readonly idpMetadata: string | null;
    readonly acsUrl: string;
    readonly spEntityId: string;
    readonly spMetadataUrl: string;
    readonly active: boolean;
    readonly provider: string;
    readonly userCount: number;
    readonly syncUserAttributes: boolean;
    readonly allowSubdomains: boolean;
    readonly allowIdpInitiated: boolean;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly attributeMapping: AttributeMapping;
    constructor(id: string, name: string, domain: string, organizationId: string | null, idpEntityId: string | null, idpSsoUrl: string | null, idpCertificate: string | null, idpMetadataUrl: string | null, idpMetadata: string | null, acsUrl: string, spEntityId: string, spMetadataUrl: string, active: boolean, provider: string, userCount: number, syncUserAttributes: boolean, allowSubdomains: boolean, allowIdpInitiated: boolean, createdAt: number, updatedAt: number, attributeMapping: AttributeMapping);
    static fromJSON(data: SamlConnectionJSON): SamlConnection;
}
export declare class SamlAccountConnection {
    readonly id: string;
    readonly name: string;
    readonly domain: string;
    readonly active: boolean;
    readonly provider: string;
    readonly syncUserAttributes: boolean;
    readonly allowSubdomains: boolean;
    readonly allowIdpInitiated: boolean;
    readonly createdAt: number;
    readonly updatedAt: number;
    constructor(id: string, name: string, domain: string, active: boolean, provider: string, syncUserAttributes: boolean, allowSubdomains: boolean, allowIdpInitiated: boolean, createdAt: number, updatedAt: number);
    static fromJSON(data: SamlAccountConnectionJSON): SamlAccountConnection;
}
declare class AttributeMapping {
    readonly userId: string;
    readonly emailAddress: string;
    readonly firstName: string;
    readonly lastName: string;
    constructor(userId: string, emailAddress: string, firstName: string, lastName: string);
    static fromJSON(data: AttributeMappingJSON): AttributeMapping;
}
export {};
//# sourceMappingURL=SamlConnection.d.ts.map