"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountSettings = void 0;
const resource_1 = require("../../resource.js");
class AccountSettings extends resource_1.APIResource {
    /**
     * Creates Worker account settings for an account.
     *
     * @example
     * ```ts
     * const accountSetting =
     *   await client.workers.accountSettings.update({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/workers/account-settings`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches Worker account settings for an account.
     *
     * @example
     * ```ts
     * const accountSetting =
     *   await client.workers.accountSettings.get({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/account-settings`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.AccountSettings = AccountSettings;
//# sourceMappingURL=account-settings.js.map