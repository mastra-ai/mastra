import type { OauthAccessTokenJSON } from './JSON';
export declare class OauthAccessToken {
    readonly externalAccountId: string;
    readonly provider: string;
    readonly token: string;
    readonly publicMetadata: Record<string, unknown>;
    readonly label: string;
    readonly scopes?: string[] | undefined;
    readonly tokenSecret?: string | undefined;
    readonly expiresAt?: number | undefined;
    constructor(externalAccountId: string, provider: string, token: string, publicMetadata: Record<string, unknown> | undefined, label: string, scopes?: string[] | undefined, tokenSecret?: string | undefined, expiresAt?: number | undefined);
    static fromJSON(data: OauthAccessTokenJSON): OauthAccessToken;
}
//# sourceMappingURL=OauthAccessToken.d.ts.map