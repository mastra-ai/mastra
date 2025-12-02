// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class Configurations extends APIResource {
    /**
     * Adds or updates the configuration for a remotely-managed tunnel.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.zeroTrust.tunnels.cloudflared.configurations.update(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    update(tunnelId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/cfd_tunnel/${tunnelId}/configurations`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Gets the configuration for a remotely-managed tunnel
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.zeroTrust.tunnels.cloudflared.configurations.get(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(tunnelId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cfd_tunnel/${tunnelId}/configurations`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=configurations.mjs.map