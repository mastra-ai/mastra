"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RayID = void 0;
const resource_1 = require("../../resource.js");
class RayID extends resource_1.APIResource {
    /**
     * The `/rayids` api route allows lookups by specific rayid. The rayids route will
     * return zero, one, or more records (ray ids are not unique).
     *
     * @example
     * ```ts
     * const RayID = await client.logs.RayID.get(
     *   '41ddf1740f67442d',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(RayID, params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/logs/rayids/${RayID}`, { query, ...options });
    }
}
exports.RayID = RayID;
//# sourceMappingURL=rayid.js.map