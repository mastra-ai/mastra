// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class Management extends APIResource {
    /**
     * Gets a management token used to access the management resources (i.e. Streaming
     * Logs) of a tunnel.
     *
     * @example
     * ```ts
     * const management =
     *   await client.zeroTrust.tunnels.cloudflared.management.create(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '699d98642c564d2e855e9661899b7252',
     *       resources: ['logs'],
     *     },
     *   );
     * ```
     */
    create(tunnelId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/cfd_tunnel/${tunnelId}/management`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=management.mjs.map