"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Recommendations = void 0;
const resource_1 = require("../../resource.js");
class Recommendations extends resource_1.APIResource {
    /**
     * Retrieve the SSL/TLS Recommender's recommendation for a zone.
     *
     * @example
     * ```ts
     * const recommendation = await client.ssl.recommendations.get(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/ssl/recommendation`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Recommendations = Recommendations;
//# sourceMappingURL=recommendations.js.map