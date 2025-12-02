"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalWARPOverride = void 0;
const resource_1 = require("../../../../resource.js");
class GlobalWARPOverride extends resource_1.APIResource {
    /**
     * Sets the Global WARP override state.
     *
     * @example
     * ```ts
     * const globalWARPOverride =
     *   await client.zeroTrust.devices.resilience.globalWARPOverride.create(
     *     {
     *       account_id: '699d98642c564d2e855e9661899b7252',
     *       disconnect: false,
     *     },
     *   );
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/devices/resilience/disconnect`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch the Global WARP override state.
     *
     * @example
     * ```ts
     * const globalWARPOverride =
     *   await client.zeroTrust.devices.resilience.globalWARPOverride.get(
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/devices/resilience/disconnect`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.GlobalWARPOverride = GlobalWARPOverride;
//# sourceMappingURL=global-warp-override.js.map