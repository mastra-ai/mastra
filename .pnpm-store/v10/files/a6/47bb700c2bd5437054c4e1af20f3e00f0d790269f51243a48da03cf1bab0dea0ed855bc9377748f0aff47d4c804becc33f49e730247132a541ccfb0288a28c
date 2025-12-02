"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Summaries = void 0;
const resource_1 = require("../../../../resource.js");
class Summaries extends resource_1.APIResource {
    /**
     * Retrieves a list of summarised aggregate metrics over a given time period.
     */
    get(params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/spectrum/analytics/events/summary`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Summaries = Summaries;
//# sourceMappingURL=summaries.js.map