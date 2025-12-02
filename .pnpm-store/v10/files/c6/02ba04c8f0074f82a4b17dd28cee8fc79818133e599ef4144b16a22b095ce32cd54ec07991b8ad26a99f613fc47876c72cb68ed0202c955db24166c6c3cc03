"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SplitTunnelExcludesSinglePage = exports.Excludes = void 0;
const resource_1 = require("../../../../../resource.js");
const policies_1 = require("../policies.js");
Object.defineProperty(exports, "SplitTunnelExcludesSinglePage", { enumerable: true, get: function () { return policies_1.SplitTunnelExcludesSinglePage; } });
class Excludes extends resource_1.APIResource {
    /**
     * Sets the list of routes excluded from the WARP client's tunnel for a specific
     * device settings profile.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const splitTunnelExclude of client.zeroTrust.devices.policies.custom.excludes.update(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   {
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     body: [{ address: '192.0.2.0/24' }],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    update(policyId, params, options) {
        const { account_id, body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/policy/${policyId}/exclude`, policies_1.SplitTunnelExcludesSinglePage, { body: body, method: 'put', ...options });
    }
    /**
     * Fetches the list of routes excluded from the WARP client's tunnel for a specific
     * device settings profile.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const splitTunnelExclude of client.zeroTrust.devices.policies.custom.excludes.get(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(policyId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/policy/${policyId}/exclude`, policies_1.SplitTunnelExcludesSinglePage, options);
    }
}
exports.Excludes = Excludes;
//# sourceMappingURL=excludes.js.map