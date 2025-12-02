// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class Networks extends APIResource {
    /**
     * Routes a private network through a Cloudflare Tunnel. The CIDR in
     * `ip_network_encoded` must be written in URL-encoded format.
     *
     * @deprecated This endpoint and its related APIs are deprecated in favor of the equivalent Tunnel Route (without CIDR) APIs.
     */
    create(ipNetworkEncoded, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/teamnet/routes/network/${ipNetworkEncoded}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes a private network route from an account. The CIDR in
     * `ip_network_encoded` must be written in URL-encoded format. If no
     * virtual_network_id is provided it will delete the route from the default vnet.
     * If no tun_type is provided it will fetch the type from the tunnel_id or if that
     * is missing it will assume Cloudflare Tunnel as default. If tunnel_id is provided
     * it will delete the route from that tunnel, otherwise it will delete the route
     * based on the vnet and tun_type.
     *
     * @deprecated This endpoint and its related APIs are deprecated in favor of the equivalent Tunnel Route (without CIDR) APIs.
     */
    delete(ipNetworkEncoded, params, options) {
        const { account_id, tun_type, tunnel_id, virtual_network_id } = params;
        return this._client.delete(`/accounts/${account_id}/teamnet/routes/network/${ipNetworkEncoded}`, {
            query: { tun_type, tunnel_id, virtual_network_id },
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an existing private network route in an account. The CIDR in
     * `ip_network_encoded` must be written in URL-encoded format.
     *
     * @deprecated This endpoint and its related APIs are deprecated in favor of the equivalent Tunnel Route (without CIDR) APIs.
     */
    edit(ipNetworkEncoded, params, options) {
        const { account_id } = params;
        return this._client.patch(`/accounts/${account_id}/teamnet/routes/network/${ipNetworkEncoded}`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=networks.mjs.map