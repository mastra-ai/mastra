// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class IPSECTunnels extends APIResource {
    /**
     * Creates a new IPsec tunnel associated with an account. Use `?validate_only=true`
     * as an optional query parameter to only run validation without persisting
     * changes.
     *
     * @example
     * ```ts
     * const ipsecTunnel =
     *   await client.magicTransit.ipsecTunnels.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     cloudflare_endpoint: '203.0.113.1',
     *     interface_address: '192.0.2.0/31',
     *     name: 'IPsec_1',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget, ...body } = params;
        return this._client.post(`/accounts/${account_id}/magic/ipsec_tunnels`, {
            body,
            ...options,
            headers: {
                ...(xMagicNewHcTarget?.toString() != null ?
                    { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a specific IPsec tunnel associated with an account. Use
     * `?validate_only=true` as an optional query parameter to only run validation
     * without persisting changes.
     *
     * @example
     * ```ts
     * const ipsecTunnel =
     *   await client.magicTransit.ipsecTunnels.update(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       cloudflare_endpoint: '203.0.113.1',
     *       interface_address: '192.0.2.0/31',
     *       name: 'IPsec_1',
     *     },
     *   );
     * ```
     */
    update(ipsecTunnelId, params, options) {
        const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget, ...body } = params;
        return this._client.put(`/accounts/${account_id}/magic/ipsec_tunnels/${ipsecTunnelId}`, {
            body,
            ...options,
            headers: {
                ...(xMagicNewHcTarget?.toString() != null ?
                    { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists IPsec tunnels associated with an account.
     *
     * @example
     * ```ts
     * const ipsecTunnels =
     *   await client.magicTransit.ipsecTunnels.list({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    list(params, options) {
        const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget } = params;
        return this._client.get(`/accounts/${account_id}/magic/ipsec_tunnels`, {
            ...options,
            headers: {
                ...(xMagicNewHcTarget?.toString() != null ?
                    { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Disables and removes a specific static IPsec Tunnel associated with an account.
     * Use `?validate_only=true` as an optional query parameter to only run validation
     * without persisting changes.
     *
     * @example
     * ```ts
     * const ipsecTunnel =
     *   await client.magicTransit.ipsecTunnels.delete(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(ipsecTunnelId, params, options) {
        const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget } = params;
        return this._client.delete(`/accounts/${account_id}/magic/ipsec_tunnels/${ipsecTunnelId}`, {
            ...options,
            headers: {
                ...(xMagicNewHcTarget?.toString() != null ?
                    { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update multiple IPsec tunnels associated with an account. Use
     * `?validate_only=true` as an optional query parameter to only run validation
     * without persisting changes.
     *
     * @example
     * ```ts
     * const response =
     *   await client.magicTransit.ipsecTunnels.bulkUpdate({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: {},
     *   });
     * ```
     */
    bulkUpdate(params, options) {
        const { account_id, body, 'x-magic-new-hc-target': xMagicNewHcTarget } = params;
        return this._client.put(`/accounts/${account_id}/magic/ipsec_tunnels`, {
            body: body,
            ...options,
            headers: {
                ...(xMagicNewHcTarget?.toString() != null ?
                    { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists details for a specific IPsec tunnel.
     *
     * @example
     * ```ts
     * const ipsecTunnel =
     *   await client.magicTransit.ipsecTunnels.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(ipsecTunnelId, params, options) {
        const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget } = params;
        return this._client.get(`/accounts/${account_id}/magic/ipsec_tunnels/${ipsecTunnelId}`, {
            ...options,
            headers: {
                ...(xMagicNewHcTarget?.toString() != null ?
                    { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Generates a Pre Shared Key for a specific IPsec tunnel used in the IKE session.
     * Use `?validate_only=true` as an optional query parameter to only run validation
     * without persisting changes. After a PSK is generated, the PSK is immediately
     * persisted to Cloudflare's edge and cannot be retrieved later. Note the PSK in a
     * safe place.
     *
     * @example
     * ```ts
     * const response =
     *   await client.magicTransit.ipsecTunnels.pskGenerate(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       body: {},
     *     },
     *   );
     * ```
     */
    pskGenerate(ipsecTunnelId, params, options) {
        const { account_id, body } = params;
        return this._client.post(`/accounts/${account_id}/magic/ipsec_tunnels/${ipsecTunnelId}/psk_generate`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=ipsec-tunnels.mjs.map