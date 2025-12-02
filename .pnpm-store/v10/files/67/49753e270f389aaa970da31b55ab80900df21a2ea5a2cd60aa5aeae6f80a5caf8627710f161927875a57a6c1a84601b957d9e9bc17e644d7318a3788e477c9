import type { OAuthApplicationJSON } from './JSON';
export declare class OAuthApplication {
    readonly id: string;
    readonly instanceId: string;
    readonly name: string;
    readonly clientId: string;
    readonly isPublic: boolean;
    readonly scopes: string;
    readonly redirectUris: Array<string>;
    readonly authorizeUrl: string;
    readonly tokenFetchUrl: string;
    readonly userInfoUrl: string;
    readonly discoveryUrl: string;
    readonly tokenIntrospectionUrl: string;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly clientSecret?: string | undefined;
    constructor(id: string, instanceId: string, name: string, clientId: string, isPublic: boolean, // NOTE: `public` is reserved
    scopes: string, redirectUris: Array<string>, authorizeUrl: string, tokenFetchUrl: string, userInfoUrl: string, discoveryUrl: string, tokenIntrospectionUrl: string, createdAt: number, updatedAt: number, clientSecret?: string | undefined);
    static fromJSON(data: OAuthApplicationJSON): OAuthApplication;
}
//# sourceMappingURL=OAuthApplication.d.ts.map