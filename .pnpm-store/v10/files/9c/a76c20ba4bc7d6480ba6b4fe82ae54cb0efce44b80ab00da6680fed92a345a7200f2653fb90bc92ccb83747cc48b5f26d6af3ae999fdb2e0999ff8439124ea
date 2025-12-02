"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Settings = void 0;
const resource_1 = require("../../../resource.js");
class Settings extends resource_1.APIResource {
    /**
     * Updates the current device settings for a Zero Trust account.
     *
     * @example
     * ```ts
     * const deviceSettings =
     *   await client.zeroTrust.devices.settings.update({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/devices/settings`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Resets the current device settings for a Zero Trust account.
     *
     * @example
     * ```ts
     * const deviceSettings =
     *   await client.zeroTrust.devices.settings.delete({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    delete(params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/devices/settings`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Patches the current device settings for a Zero Trust account.
     *
     * @example
     * ```ts
     * const deviceSettings =
     *   await client.zeroTrust.devices.settings.edit({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    edit(params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/devices/settings`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Describes the current device settings for a Zero Trust account.
     *
     * @example
     * ```ts
     * const deviceSettings =
     *   await client.zeroTrust.devices.settings.get({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/devices/settings`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Settings = Settings;
//# sourceMappingURL=settings.js.map