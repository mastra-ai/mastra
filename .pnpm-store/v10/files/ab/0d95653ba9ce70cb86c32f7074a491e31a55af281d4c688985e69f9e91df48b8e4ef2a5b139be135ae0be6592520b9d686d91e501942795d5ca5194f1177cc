"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bytimes = void 0;
const resource_1 = require("../../../../resource.js");
class Bytimes extends resource_1.APIResource {
    /**
     * Retrieves a list of aggregate metrics grouped by time interval.
     */
    get(params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/spectrum/analytics/events/bytime`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Bytimes = Bytimes;
//# sourceMappingURL=bytimes.js.map