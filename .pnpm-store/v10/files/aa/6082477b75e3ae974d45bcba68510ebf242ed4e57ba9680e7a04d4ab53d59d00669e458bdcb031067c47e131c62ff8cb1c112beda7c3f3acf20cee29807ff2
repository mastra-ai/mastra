"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Connectors = void 0;
const resource_1 = require("../../../../resource.js");
class Connectors extends resource_1.APIResource {
    /**
     * Fetches connector and connection details for a Cloudflare Tunnel.
     *
     * @example
     * ```ts
     * const client =
     *   await client.zeroTrust.tunnels.cloudflared.connectors.get(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     '1bedc50d-42b3-473c-b108-ff3d10c0d925',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(tunnelId, connectorId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cfd_tunnel/${tunnelId}/connectors/${connectorId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Connectors = Connectors;
//# sourceMappingURL=connectors.js.map