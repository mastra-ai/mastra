// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { SinglePage } from "../../../../pagination.mjs";
export class Connections extends APIResource {
    /**
     * Removes a connection (aka Cloudflare Tunnel Connector) from a Cloudflare Tunnel
     * independently of its current state. If no connector id (client_id) is provided
     * all connectors will be removed. We recommend running this command after rotating
     * tokens.
     *
     * @example
     * ```ts
     * const connection =
     *   await client.zeroTrust.tunnels.cloudflared.connections.delete(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    delete(tunnelId, params, options) {
        const { account_id, client_id } = params;
        return this._client.delete(`/accounts/${account_id}/cfd_tunnel/${tunnelId}/connections`, {
            query: { client_id },
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches connection details for a Cloudflare Tunnel.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const client of client.zeroTrust.tunnels.cloudflared.connections.get(
     *   'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(tunnelId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/cfd_tunnel/${tunnelId}/connections`, ClientsSinglePage, options);
    }
}
export class ClientsSinglePage extends SinglePage {
}
Connections.ClientsSinglePage = ClientsSinglePage;
//# sourceMappingURL=connections.mjs.map