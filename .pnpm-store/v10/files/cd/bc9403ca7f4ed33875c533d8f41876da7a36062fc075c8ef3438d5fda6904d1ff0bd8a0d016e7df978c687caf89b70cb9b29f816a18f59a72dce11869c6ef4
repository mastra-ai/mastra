"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForceAXFRResource = void 0;
const resource_1 = require("../../../resource.js");
class ForceAXFRResource extends resource_1.APIResource {
    /**
     * Sends AXFR zone transfer request to primary nameserver(s).
     *
     * @example
     * ```ts
     * const forceAXFR =
     *   await client.dns.zoneTransfers.forceAXFR.create({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *     body: {},
     *   });
     * ```
     */
    create(params, options) {
        const { zone_id, body } = params;
        return this._client.post(`/zones/${zone_id}/secondary_dns/force_axfr`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.ForceAXFRResource = ForceAXFRResource;
//# sourceMappingURL=force-axfr.js.map