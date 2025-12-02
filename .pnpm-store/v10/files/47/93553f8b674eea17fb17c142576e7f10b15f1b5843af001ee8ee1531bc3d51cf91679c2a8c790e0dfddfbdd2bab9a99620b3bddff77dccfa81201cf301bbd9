"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountsV4PagePaginationArray = exports.Accounts = void 0;
const resource_1 = require("../../resource.js");
const core_1 = require("../../core.js");
const MembersAPI = __importStar(require("./members.js"));
const members_1 = require("./members.js");
const RolesAPI = __importStar(require("./roles.js"));
const roles_1 = require("./roles.js");
const SubscriptionsAPI = __importStar(require("./subscriptions.js"));
const subscriptions_1 = require("./subscriptions.js");
const LogsAPI = __importStar(require("./logs/logs.js"));
const logs_1 = require("./logs/logs.js");
const TokensAPI = __importStar(require("./tokens/tokens.js"));
const tokens_1 = require("./tokens/tokens.js");
const pagination_1 = require("../../pagination.js");
class Accounts extends resource_1.APIResource {
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
        if ((0, core_1.isRequestOptions)(query)) {
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
exports.Accounts = Accounts;
class AccountsV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.AccountsV4PagePaginationArray = AccountsV4PagePaginationArray;
Accounts.AccountsV4PagePaginationArray = AccountsV4PagePaginationArray;
Accounts.Members = members_1.Members;
Accounts.Roles = roles_1.Roles;
Accounts.Subscriptions = subscriptions_1.Subscriptions;
Accounts.Tokens = tokens_1.Tokens;
Accounts.Logs = logs_1.Logs;
//# sourceMappingURL=accounts.js.map