"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Token = void 0;
const resource_1 = require("../../../../resource.js");
class Token extends resource_1.APIResource {
    /**
     * Gets the token used to associate warp device with a specific Warp Connector
     * tunnel.
     *
     * @example
     * ```ts
     * const token =
     *   await client.zeroTrust.tunnels.warpConnector.token.get(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(tunnelId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/warp_connector/${tunnelId}/token`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Token = Token;
//# sourceMappingURL=token.js.map