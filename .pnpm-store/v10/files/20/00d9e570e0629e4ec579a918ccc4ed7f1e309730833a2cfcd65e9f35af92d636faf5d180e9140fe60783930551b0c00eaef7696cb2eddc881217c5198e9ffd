"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Settings = void 0;
const resource_1 = require("../../resource.js");
class Settings extends resource_1.APIResource {
    /**
     * Update the current settings for the active account
     *
     * @example
     * ```ts
     * const setting =
     *   await client.networkInterconnects.settings.update({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/cni/settings`, { body, ...options });
    }
    /**
     * Get the current settings for the active account
     *
     * @example
     * ```ts
     * const setting =
     *   await client.networkInterconnects.settings.get({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cni/settings`, options);
    }
}
exports.Settings = Settings;
//# sourceMappingURL=settings.js.map