import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as MembersAPI from "./members.js";
import { MemberCreateParams, MemberDeleteParams, MemberDeleteResponse, MemberGetParams, MemberListParams, MemberUpdateParams, Members, Status } from "./members.js";
import * as RolesAPI from "./roles.js";
import { RoleGetParams, RoleListParams, Roles } from "./roles.js";
import * as SubscriptionsAPI from "./subscriptions.js";
import { SubscriptionCreateParams, SubscriptionDeleteParams, SubscriptionDeleteResponse, SubscriptionGetParams, SubscriptionUpdateParams, Subscriptions } from "./subscriptions.js";
import * as LogsAPI from "./logs/logs.js";
import { Logs } from "./logs/logs.js";
import * as TokensAPI from "./tokens/tokens.js";
import { TokenCreateParams, TokenCreateResponse, TokenDeleteParams, TokenDeleteResponse, TokenGetParams, TokenListParams, TokenUpdateParams, TokenVerifyParams, TokenVerifyResponse, Tokens } from "./tokens/tokens.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class Accounts extends APIResource {
    members: MembersAPI.Members;
    roles: RolesAPI.Roles;
    subscriptions: SubscriptionsAPI.Subscriptions;
    tokens: TokensAPI.Tokens;
    logs: LogsAPI.Logs;
    /**
     * Create an account (only available for tenant admins at this time)
     *
     * @example
     * ```ts
     * const account = await client.accounts.create({
     *   name: 'name',
     *   type: 'standard',
     * });
     * ```
     */
    create(body: AccountCreateParams, options?: Core.RequestOptions): Core.APIPromise<Account>;
    /**
     * Update an existing account.
     *
     * @example
     * ```ts
     * const account = await client.accounts.update({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'Demo Account',
     * });
     * ```
     */
    update(params: AccountUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Account>;
    /**
     * List all accounts you have ownership or verified access to.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const account of client.accounts.list()) {
     *   // ...
     * }
     * ```
     */
    list(query?: AccountListParams, options?: Core.RequestOptions): Core.PagePromise<AccountsV4PagePaginationArray, Account>;
    list(options?: Core.RequestOptions): Core.PagePromise<AccountsV4PagePaginationArray, Account>;
    /**
     * Delete a specific account (only available for tenant admins at this time). This
     * is a permanent operation that will delete any zones or other resources under the
     * account
     *
     * @example
     * ```ts
     * const account = await client.accounts.delete({
     *   account_id: 'account_id',
     * });
     * ```
     */
    delete(params: AccountDeleteParams, options?: Core.RequestOptions): Core.APIPromise<AccountDeleteResponse | null>;
    /**
     * Get information about a specific account that you are a member of.
     *
     * @example
     * ```ts
     * const account = await client.accounts.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: AccountGetParams, options?: Core.RequestOptions): Core.APIPromise<Account>;
}
export declare class AccountsV4PagePaginationArray extends V4PagePaginationArray<Account> {
}
export interface Account {
    /**
     * Identifier
     */
    id: string;
    /**
     * Account name
     */
    name: string;
    /**
     * Timestamp for the creation of the account
     */
    created_on?: string;
    /**
     * Account settings
     */
    settings?: Account.Settings;
}
export declare namespace Account {
    /**
     * Account settings
     */
    interface Settings {
        /**
         * Sets an abuse contact email to notify for abuse reports.
         */
        abuse_contact_email?: string;
        /**
         * Indicates whether membership in this account requires that Two-Factor
         * Authentication is enabled
         */
        enforce_twofactor?: boolean;
    }
}
export interface AccountDeleteResponse {
    /**
     * Identifier
     */
    id: string;
}
export interface AccountCreateParams {
    /**
     * Account name
     */
    name: string;
    /**
     * the type of account being created. For self-serve customers, use standard. for
     * enterprise customers, use enterprise.
     */
    type: 'standard' | 'enterprise';
    /**
     * information related to the tenant unit, and optionally, an id of the unit to
     * create the account on. see
     * https://developers.cloudflare.com/tenant/how-to/manage-accounts/
     */
    unit?: AccountCreateParams.Unit;
}
export declare namespace AccountCreateParams {
    /**
     * information related to the tenant unit, and optionally, an id of the unit to
     * create the account on. see
     * https://developers.cloudflare.com/tenant/how-to/manage-accounts/
     */
    interface Unit {
        /**
         * Tenant unit ID
         */
        id?: string;
    }
}
export interface AccountUpdateParams {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;
    /**
     * Body param: Identifier
     */
    id: string;
    /**
     * Body param: Account name
     */
    name: string;
    /**
     * Body param: Account settings
     */
    settings?: AccountUpdateParams.Settings;
}
export declare namespace AccountUpdateParams {
    /**
     * Account settings
     */
    interface Settings {
        /**
         * Sets an abuse contact email to notify for abuse reports.
         */
        abuse_contact_email?: string;
        /**
         * Indicates whether membership in this account requires that Two-Factor
         * Authentication is enabled
         */
        enforce_twofactor?: boolean;
    }
}
export interface AccountListParams extends V4PagePaginationArrayParams {
    /**
     * Direction to order results.
     */
    direction?: 'asc' | 'desc';
    /**
     * Name of the account.
     */
    name?: string;
}
export interface AccountDeleteParams {
    /**
     * The account ID of the account to be deleted
     */
    account_id: string;
}
export interface AccountGetParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export declare namespace Accounts {
    export { type Account as Account, type AccountDeleteResponse as AccountDeleteResponse, AccountsV4PagePaginationArray as AccountsV4PagePaginationArray, type AccountCreateParams as AccountCreateParams, type AccountUpdateParams as AccountUpdateParams, type AccountListParams as AccountListParams, type AccountDeleteParams as AccountDeleteParams, type AccountGetParams as AccountGetParams, };
    export { Members as Members, type Status as Status, type MemberDeleteResponse as MemberDeleteResponse, type MemberCreateParams as MemberCreateParams, type MemberUpdateParams as MemberUpdateParams, type MemberListParams as MemberListParams, type MemberDeleteParams as MemberDeleteParams, type MemberGetParams as MemberGetParams, };
    export { Roles as Roles, type RoleListParams as RoleListParams, type RoleGetParams as RoleGetParams };
    export { Subscriptions as Subscriptions, type SubscriptionDeleteResponse as SubscriptionDeleteResponse, type SubscriptionCreateParams as SubscriptionCreateParams, type SubscriptionUpdateParams as SubscriptionUpdateParams, type SubscriptionDeleteParams as SubscriptionDeleteParams, type SubscriptionGetParams as SubscriptionGetParams, };
    export { Tokens as Tokens, type TokenCreateResponse as TokenCreateResponse, type TokenDeleteResponse as TokenDeleteResponse, type TokenVerifyResponse as TokenVerifyResponse, type TokenCreateParams as TokenCreateParams, type TokenUpdateParams as TokenUpdateParams, type TokenListParams as TokenListParams, type TokenDeleteParams as TokenDeleteParams, type TokenGetParams as TokenGetParams, type TokenVerifyParams as TokenVerifyParams, };
    export { Logs as Logs };
}
//# sourceMappingURL=accounts.d.ts.map