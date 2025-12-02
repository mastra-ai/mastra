import type { AccessTokenRole, AuthType } from "../public";
interface ApiWhoAmIBase {
    /** Unique ID persistent across renames */
    id: string;
    type: "user" | "org" | "app";
    name: string;
}
interface ApiWhoAmIEntityBase extends ApiWhoAmIBase {
    fullname: string;
    email: string | null;
    canPay: boolean;
    avatarUrl: string;
    /**
     * Unix timestamp in seconds
     */
    periodEnd: number | null;
}
interface ApiWhoAmIOrg extends ApiWhoAmIEntityBase {
    type: "org";
}
interface ApiWhoAmIUser extends ApiWhoAmIEntityBase {
    type: "user";
    email: string;
    emailVerified: boolean;
    isPro: boolean;
    orgs: ApiWhoAmIOrg[];
}
interface ApiWhoAmIApp extends ApiWhoAmIBase {
    type: "app";
    name: string;
    scope?: {
        entities: string[];
        role: AccessTokenRole;
    };
}
export type ApiWhoAmIReponse = ApiWhoAmIUser | ApiWhoAmIOrg | ApiWhoAmIApp;
export interface ApiWhoAmIAuthInfo {
    type: AuthType;
    accessToken?: {
        displayName: string;
        expiration?: string;
        role: AccessTokenRole;
    };
}
export {};
//# sourceMappingURL=api-who-am-i.d.ts.map