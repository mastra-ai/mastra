import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as AuditLogsAPI from "./audit-logs.js";
import { AuditLogListParams, AuditLogs } from "./audit-logs.js";
import * as InvitesAPI from "./invites.js";
import { Invite, InviteEditParams, Invites, InvitesSinglePage } from "./invites.js";
import * as OrganizationsAPI from "./organizations.js";
import { Organization, OrganizationDeleteResponse, OrganizationGetResponse, OrganizationListParams, Organizations, OrganizationsV4PagePaginationArray } from "./organizations.js";
import * as SubscriptionsAPI from "./subscriptions.js";
import { SubscriptionDeleteResponse, SubscriptionUpdateParams, SubscriptionUpdateResponse, Subscriptions } from "./subscriptions.js";
import * as BillingAPI from "./billing/billing.js";
import { Billing } from "./billing/billing.js";
import * as TokensAPI from "./tokens/tokens.js";
import { TokenCreateParams, TokenCreateResponse, TokenDeleteResponse, TokenListParams, TokenUpdateParams, TokenVerifyResponse, Tokens } from "./tokens/tokens.js";
export declare class User extends APIResource {
    auditLogs: AuditLogsAPI.AuditLogs;
    billing: BillingAPI.Billing;
    invites: InvitesAPI.Invites;
    organizations: OrganizationsAPI.Organizations;
    subscriptions: SubscriptionsAPI.Subscriptions;
    tokens: TokensAPI.Tokens;
    /**
     * Edit part of your user details.
     *
     * @example
     * ```ts
     * const response = await client.user.edit();
     * ```
     */
    edit(body: UserEditParams, options?: Core.RequestOptions): Core.APIPromise<UserEditResponse>;
    /**
     * User Details
     *
     * @example
     * ```ts
     * const user = await client.user.get();
     * ```
     */
    get(options?: Core.RequestOptions): Core.APIPromise<UserGetResponse>;
}
export interface UserEditResponse {
    /**
     * Identifier of the user.
     */
    id?: string;
    /**
     * Lists the betas that the user is participating in.
     */
    betas?: Array<string>;
    /**
     * The country in which the user lives.
     */
    country?: string | null;
    /**
     * User's first name
     */
    first_name?: string | null;
    /**
     * Indicates whether user has any business zones
     */
    has_business_zones?: boolean;
    /**
     * Indicates whether user has any enterprise zones
     */
    has_enterprise_zones?: boolean;
    /**
     * Indicates whether user has any pro zones
     */
    has_pro_zones?: boolean;
    /**
     * User's last name
     */
    last_name?: string | null;
    organizations?: Array<OrganizationsAPI.Organization>;
    /**
     * Indicates whether user has been suspended
     */
    suspended?: boolean;
    /**
     * User's telephone number
     */
    telephone?: string | null;
    /**
     * Indicates whether two-factor authentication is enabled for the user account.
     * Does not apply to API authentication.
     */
    two_factor_authentication_enabled?: boolean;
    /**
     * Indicates whether two-factor authentication is required by one of the accounts
     * that the user is a member of.
     */
    two_factor_authentication_locked?: boolean;
    /**
     * The zipcode or postal code where the user lives.
     */
    zipcode?: string | null;
}
export interface UserGetResponse {
    /**
     * Identifier of the user.
     */
    id?: string;
    /**
     * Lists the betas that the user is participating in.
     */
    betas?: Array<string>;
    /**
     * The country in which the user lives.
     */
    country?: string | null;
    /**
     * User's first name
     */
    first_name?: string | null;
    /**
     * Indicates whether user has any business zones
     */
    has_business_zones?: boolean;
    /**
     * Indicates whether user has any enterprise zones
     */
    has_enterprise_zones?: boolean;
    /**
     * Indicates whether user has any pro zones
     */
    has_pro_zones?: boolean;
    /**
     * User's last name
     */
    last_name?: string | null;
    organizations?: Array<OrganizationsAPI.Organization>;
    /**
     * Indicates whether user has been suspended
     */
    suspended?: boolean;
    /**
     * User's telephone number
     */
    telephone?: string | null;
    /**
     * Indicates whether two-factor authentication is enabled for the user account.
     * Does not apply to API authentication.
     */
    two_factor_authentication_enabled?: boolean;
    /**
     * Indicates whether two-factor authentication is required by one of the accounts
     * that the user is a member of.
     */
    two_factor_authentication_locked?: boolean;
    /**
     * The zipcode or postal code where the user lives.
     */
    zipcode?: string | null;
}
export interface UserEditParams {
    /**
     * The country in which the user lives.
     */
    country?: string | null;
    /**
     * User's first name
     */
    first_name?: string | null;
    /**
     * User's last name
     */
    last_name?: string | null;
    /**
     * User's telephone number
     */
    telephone?: string | null;
    /**
     * The zipcode or postal code where the user lives.
     */
    zipcode?: string | null;
}
export declare namespace User {
    export { type UserEditResponse as UserEditResponse, type UserGetResponse as UserGetResponse, type UserEditParams as UserEditParams, };
    export { AuditLogs as AuditLogs, type AuditLogListParams as AuditLogListParams };
    export { Billing as Billing };
    export { Invites as Invites, type Invite as Invite, InvitesSinglePage as InvitesSinglePage, type InviteEditParams as InviteEditParams, };
    export { Organizations as Organizations, type Organization as Organization, type OrganizationDeleteResponse as OrganizationDeleteResponse, type OrganizationGetResponse as OrganizationGetResponse, OrganizationsV4PagePaginationArray as OrganizationsV4PagePaginationArray, type OrganizationListParams as OrganizationListParams, };
    export { Subscriptions as Subscriptions, type SubscriptionUpdateResponse as SubscriptionUpdateResponse, type SubscriptionDeleteResponse as SubscriptionDeleteResponse, type SubscriptionUpdateParams as SubscriptionUpdateParams, };
    export { Tokens as Tokens, type TokenCreateResponse as TokenCreateResponse, type TokenDeleteResponse as TokenDeleteResponse, type TokenVerifyResponse as TokenVerifyResponse, type TokenCreateParams as TokenCreateParams, type TokenUpdateParams as TokenUpdateParams, type TokenListParams as TokenListParams, };
}
//# sourceMappingURL=user.d.ts.map