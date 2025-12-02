"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Status = void 0;
const resource_1 = require("../../../../resource.js");
class Status extends resource_1.APIResource {
    /**
     * Get primary zone transfer status.
     *
     * @example
     * ```ts
     * const enableTransfer =
     *   await client.dns.zoneTransfers.outgoing.status.get({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *   });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/secondary_dns/outgoing/status`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Status = Status;
//# sourceMappingURL=status.js.map