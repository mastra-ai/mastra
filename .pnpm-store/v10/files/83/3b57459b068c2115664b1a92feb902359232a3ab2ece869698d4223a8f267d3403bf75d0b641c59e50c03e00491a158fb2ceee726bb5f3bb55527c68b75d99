"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectivitySettings = void 0;
const resource_1 = require("../../resource.js");
class ConnectivitySettings extends resource_1.APIResource {
    /**
     * Updates the Zero Trust Connectivity Settings for the given account.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.connectivitySettings.edit({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    edit(params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/zerotrust/connectivity_settings`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Gets the Zero Trust Connectivity Settings for the given account.
     *
     * @example
     * ```ts
     * const connectivitySetting =
     *   await client.zeroTrust.connectivitySettings.get({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/zerotrust/connectivity_settings`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.ConnectivitySettings = ConnectivitySettings;
//# sourceMappingURL=connectivity-settings.js.map