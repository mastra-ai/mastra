// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class Token extends APIResource {
    /**
     * Gets the token used to associate cloudflared with a specific tunnel.
     *
     * @example
     * ```ts
     * const token =
     *   await client.zeroTrust.tunnels.cloudflared.token.get(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(tunnelId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cfd_tunnel/${tunnelId}/token`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=token.mjs.map