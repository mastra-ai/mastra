import type { SamlAccountJSON } from './JSON';
import { SamlAccountConnection } from './SamlConnection';
import { Verification } from './Verification';
export declare class SamlAccount {
    readonly id: string;
    readonly provider: string;
    readonly providerUserId: string | null;
    readonly active: boolean;
    readonly emailAddress: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly verification: Verification | null;
    readonly samlConnection: SamlAccountConnection | null;
    constructor(id: string, provider: string, providerUserId: string | null, active: boolean, emailAddress: string, firstName: string, lastName: string, verification: Verification | null, samlConnection: SamlAccountConnection | null);
    static fromJSON(data: SamlAccountJSON): SamlAccount;
}
//# sourceMappingURL=SamlAccount.d.ts.map