// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { isRequestOptions } from "../../core.mjs";
import * as MembersAPI from "./members.mjs";
import { Members, } from "./members.mjs";
import * as RolesAPI from "./roles.mjs";
import { Roles } from "./roles.mjs";
import * as SubscriptionsAPI from "./subscriptions.mjs";
import { Subscriptions, } from "./subscriptions.mjs";
import * as LogsAPI from "./logs/logs.mjs";
import { Logs } from "./logs/logs.mjs";
import * as TokensAPI from "./tokens/tokens.mjs";
import { Tokens, } from "./tokens/tokens.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class Accounts extends APIResource {
    constructor() {
        super(...arguments);
        this.members = new MembersAPI.Members(this._client);
        this.roles = new RolesAPI.Roles(this._client);
        this.subscriptions = new SubscriptionsAPI.Subscriptions(this._client);
        this.tokens = new TokensAPI.Tokens(this._client);
        this.logs = new LogsAPI.Logs(this._client);
    }
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
    create(body, options) {
        return this._client.post('/accounts', { body, ...options })._thenUnwrap((obj) => obj.result);
    }
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
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    list(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/accounts', AccountsV4PagePaginationArray, { query, ...options });
    }
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
    delete(params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}`, options)._thenUnwrap((obj) => obj.result);
    }
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
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class AccountsV4PagePaginationArray extends V4PagePaginationArray {
}
Accounts.AccountsV4PagePaginationArray = AccountsV4PagePaginationArray;
Accounts.Members = Members;
Accounts.Roles = Roles;
Accounts.Subscriptions = Subscriptions;
Accounts.Tokens = Tokens;
Accounts.Logs = Logs;
//# sourceMappingURL=accounts.mjs.map