import type { OrganizationJSON } from './JSON';
export declare class Organization {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly imageUrl: string;
    readonly hasImage: boolean;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly publicMetadata: OrganizationPublicMetadata | null;
    readonly privateMetadata: OrganizationPrivateMetadata;
    readonly maxAllowedMemberships: number;
    readonly adminDeleteEnabled: boolean;
    readonly membersCount?: number | undefined;
    readonly createdBy?: string | undefined;
    private _raw;
    get raw(): OrganizationJSON | null;
    constructor(id: string, name: string, slug: string, imageUrl: string, hasImage: boolean, createdAt: number, updatedAt: number, publicMetadata: (OrganizationPublicMetadata | null) | undefined, privateMetadata: OrganizationPrivateMetadata | undefined, maxAllowedMemberships: number, adminDeleteEnabled: boolean, membersCount?: number | undefined, createdBy?: string | undefined);
    static fromJSON(data: OrganizationJSON): Organization;
}
//# sourceMappingURL=Organization.d.ts.map