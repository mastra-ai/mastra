import type { ExternalAccountJSON } from './JSON';
import { Verification } from './Verification';
export declare class ExternalAccount {
    readonly id: string;
    readonly provider: string;
    readonly identificationId: string;
    readonly externalId: string;
    readonly approvedScopes: string;
    readonly emailAddress: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly imageUrl: string;
    readonly username: string | null;
    readonly phoneNumber: string | null;
    readonly publicMetadata: Record<string, unknown> | null;
    readonly label: string | null;
    readonly verification: Verification | null;
    constructor(id: string, provider: string, identificationId: string, externalId: string, approvedScopes: string, emailAddress: string, firstName: string, lastName: string, imageUrl: string, username: string | null, phoneNumber: string | null, publicMetadata: (Record<string, unknown> | null) | undefined, label: string | null, verification: Verification | null);
    static fromJSON(data: ExternalAccountJSON): ExternalAccount;
}
//# sourceMappingURL=ExternalAccount.d.ts.map