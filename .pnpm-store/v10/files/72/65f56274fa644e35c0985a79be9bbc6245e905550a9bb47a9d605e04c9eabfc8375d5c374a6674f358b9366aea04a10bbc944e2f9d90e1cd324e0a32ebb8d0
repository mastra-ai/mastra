"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncomingResource = void 0;
const resource_1 = require("../../../resource.js");
class IncomingResource extends resource_1.APIResource {
    /**
     * Create secondary zone configuration for incoming zone transfers.
     *
     * @example
     * ```ts
     * const incoming =
     *   await client.dns.zoneTransfers.incoming.create({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *     auto_refresh_seconds: 86400,
     *     name: 'www.example.com.',
     *     peers: [
     *       '23ff594956f20c2a721606e94745a8aa',
     *       '00920f38ce07c2e2f4df50b1f61d4194',
     *     ],
     *   });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/secondary_dns/incoming`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update secondary zone configuration for incoming zone transfers.
     *
     * @example
     * ```ts
     * const incoming =
     *   await client.dns.zoneTransfers.incoming.update({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *     auto_refresh_seconds: 86400,
     *     name: 'www.example.com.',
     *     peers: [
     *       '23ff594956f20c2a721606e94745a8aa',
     *       '00920f38ce07c2e2f4df50b1f61d4194',
     *     ],
     *   });
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/secondary_dns/incoming`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Delete secondary zone configuration for incoming zone transfers.
     *
     * @example
     * ```ts
     * const incoming =
     *   await client.dns.zoneTransfers.incoming.delete({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *   });
     * ```
     */
    delete(params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/secondary_dns/incoming`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get secondary zone configuration for incoming zone transfers.
     *
     * @example
     * ```ts
     * const incoming =
     *   await client.dns.zoneTransfers.incoming.get({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *   });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/secondary_dns/incoming`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.IncomingResource = IncomingResource;
//# sourceMappingURL=incoming.js.map