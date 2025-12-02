"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Currents = void 0;
const resource_1 = require("../../../../resource.js");
class Currents extends resource_1.APIResource {
    /**
     * Retrieves analytics aggregated from the last minute of usage on Spectrum
     * applications underneath a given zone.
     */
    get(params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/spectrum/analytics/aggregate/current`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Currents = Currents;
//# sourceMappingURL=currents.js.map