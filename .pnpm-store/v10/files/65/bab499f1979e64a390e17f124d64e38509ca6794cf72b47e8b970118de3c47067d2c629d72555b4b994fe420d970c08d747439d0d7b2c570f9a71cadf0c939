import type { AccessTokenRole, AuthType, Credentials } from "../types/public";
export interface WhoAmIUser {
    /** Unique ID persistent across renames */
    id: string;
    type: "user";
    email: string;
    emailVerified: boolean;
    isPro: boolean;
    orgs: WhoAmIOrg[];
    name: string;
    fullname: string;
    canPay: boolean;
    avatarUrl: string;
    /**
     * Unix timestamp in seconds
     */
    periodEnd: number | null;
}
export interface WhoAmIOrg {
    /** Unique ID persistent across renames */
    id: string;
    type: "org";
    name: string;
    fullname: string;
    email: string | null;
    canPay: boolean;
    avatarUrl: string;
    /**
     * Unix timestamp in seconds
     */
    periodEnd: number | null;
}
export interface WhoAmIApp {
    id: string;
    type: "app";
    name: string;
    scope?: {
        entities: string[];
        role: "admin" | "write" | "contributor" | "read";
    };
}
export type WhoAmI = WhoAmIApp | WhoAmIOrg | WhoAmIUser;
export interface AuthInfo {
    type: AuthType;
    accessToken?: {
        displayName: string;
        role: AccessTokenRole;
        createdAt: Date;
    };
    expiresAt?: Date;
}
export declare function whoAmI(params: {
    credentials: Credentials;
    hubUrl?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
}): Promise<WhoAmI & {
    auth: AuthInfo;
}>;
//# sourceMappingURL=who-am-i.d.ts.map