"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SplitTunnelIncludesSinglePage = exports.Includes = void 0;
const resource_1 = require("../../../../../resource.js");
const policies_1 = require("../policies.js");
Object.defineProperty(exports, "SplitTunnelIncludesSinglePage", { enumerable: true, get: function () { return policies_1.SplitTunnelIncludesSinglePage; } });
class Includes extends resource_1.APIResource {
    /**
     * Sets the list of routes included in the WARP client's tunnel.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const splitTunnelInclude of client.zeroTrust.devices.policies.default.includes.update(
     *   {
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     body: [{ address: '192.0.2.0/24' }],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    update(params, options) {
        const { account_id, body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/policy/include`, policies_1.SplitTunnelIncludesSinglePage, { body: body, method: 'put', ...options });
    }
    /**
     * Fetches the list of routes included in the WARP client's tunnel.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const splitTunnelInclude of client.zeroTrust.devices.policies.default.includes.get(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/policy/include`, policies_1.SplitTunnelIncludesSinglePage, options);
    }
}
exports.Includes = Includes;
//# sourceMappingURL=includes.js.map