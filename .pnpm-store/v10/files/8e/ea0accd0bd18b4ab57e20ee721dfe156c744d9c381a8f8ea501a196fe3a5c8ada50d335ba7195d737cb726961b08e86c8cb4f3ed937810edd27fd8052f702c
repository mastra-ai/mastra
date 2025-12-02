"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeersSinglePage = exports.Peers = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Peers extends resource_1.APIResource {
    /**
     * Create Peer.
     *
     * @example
     * ```ts
     * const peer = await client.dns.zoneTransfers.peers.create({
     *   account_id: '01a7362d577a6c3019a474fd6f485823',
     *   name: 'my-peer-1',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/secondary_dns/peers`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Modify Peer.
     *
     * @example
     * ```ts
     * const peer = await client.dns.zoneTransfers.peers.update(
     *   '23ff594956f20c2a721606e94745a8aa',
     *   {
     *     account_id: '01a7362d577a6c3019a474fd6f485823',
     *     name: 'my-peer-1',
     *   },
     * );
     * ```
     */
    update(peerId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/secondary_dns/peers/${peerId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List Peers.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const peer of client.dns.zoneTransfers.peers.list(
     *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/secondary_dns/peers`, PeersSinglePage, options);
    }
    /**
     * Delete Peer.
     *
     * @example
     * ```ts
     * const peer = await client.dns.zoneTransfers.peers.delete(
     *   '23ff594956f20c2a721606e94745a8aa',
     *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
     * );
     * ```
     */
    delete(peerId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/secondary_dns/peers/${peerId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get Peer.
     *
     * @example
     * ```ts
     * const peer = await client.dns.zoneTransfers.peers.get(
     *   '23ff594956f20c2a721606e94745a8aa',
     *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
     * );
     * ```
     */
    get(peerId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/secondary_dns/peers/${peerId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Peers = Peers;
class PeersSinglePage extends pagination_1.SinglePage {
}
exports.PeersSinglePage = PeersSinglePage;
Peers.PeersSinglePage = PeersSinglePage;
//# sourceMappingURL=peers.js.map