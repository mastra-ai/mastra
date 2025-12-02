"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRETunnels = void 0;
const resource_1 = require("../../resource.js");
class GRETunnels extends resource_1.APIResource {
    /**
     * Creates a new GRE tunnel. Use `?validate_only=true` as an optional query
     * parameter to only run validation without persisting changes.
     *
     * @example
     * ```ts
     * const greTunnel =
     *   await client.magicTransit.greTunnels.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     cloudflare_gre_endpoint: '203.0.113.1',
     *     customer_gre_endpoint: '203.0.113.1',
     *     interface_address: '192.0.2.0/31',
     *     name: 'GRE_1',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget, ...body } = params;
        return this._client.post(`/accounts/${account_id}/magic/gre_tunnels`, {
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
     * Updates a specific GRE tunnel. Use `?validate_only=true` as an optional query
     * parameter to only run validation without persisting changes.
     *
     * @example
     * ```ts
     * const greTunnel =
     *   await client.magicTransit.greTunnels.update(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       cloudflare_gre_endpoint: '203.0.113.1',
     *       customer_gre_endpoint: '203.0.113.1',
     *       interface_address: '192.0.2.0/31',
     *       name: 'GRE_1',
     *     },
     *   );
     * ```
     */
    update(greTunnelId, params, options) {
        const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget, ...body } = params;
        return this._client.put(`/accounts/${account_id}/magic/gre_tunnels/${greTunnelId}`, {
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
     * Lists GRE tunnels associated with an account.
     *
     * @example
     * ```ts
     * const greTunnels =
     *   await client.magicTransit.greTunnels.list({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    list(params, options) {
        const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget } = params;
        return this._client.get(`/accounts/${account_id}/magic/gre_tunnels`, {
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
     * Disables and removes a specific static GRE tunnel. Use `?validate_only=true` as
     * an optional query parameter to only run validation without persisting changes.
     *
     * @example
     * ```ts
     * const greTunnel =
     *   await client.magicTransit.greTunnels.delete(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(greTunnelId, params, options) {
        const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget } = params;
        return this._client.delete(`/accounts/${account_id}/magic/gre_tunnels/${greTunnelId}`, {
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
     * Updates multiple GRE tunnels. Use `?validate_only=true` as an optional query
     * parameter to only run validation without persisting changes.
     *
     * @example
     * ```ts
     * const response =
     *   await client.magicTransit.greTunnels.bulkUpdate({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: {},
     *   });
     * ```
     */
    bulkUpdate(params, options) {
        const { account_id, body, 'x-magic-new-hc-target': xMagicNewHcTarget } = params;
        return this._client.put(`/accounts/${account_id}/magic/gre_tunnels`, {
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
     * Lists informtion for a specific GRE tunnel.
     *
     * @example
     * ```ts
     * const greTunnel = await client.magicTransit.greTunnels.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(greTunnelId, params, options) {
        const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget } = params;
        return this._client.get(`/accounts/${account_id}/magic/gre_tunnels/${greTunnelId}`, {
            ...options,
            headers: {
                ...(xMagicNewHcTarget?.toString() != null ?
                    { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.GRETunnels = GRETunnels;
//# sourceMappingURL=gre-tunnels.js.map