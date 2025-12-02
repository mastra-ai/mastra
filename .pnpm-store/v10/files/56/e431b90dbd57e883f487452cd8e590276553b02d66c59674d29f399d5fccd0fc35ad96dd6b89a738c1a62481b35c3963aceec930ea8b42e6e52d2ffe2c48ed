"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RatePlanGetResponsesSinglePage = exports.RatePlans = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class RatePlans extends resource_1.APIResource {
    /**
     * Lists all rate plans the zone can subscribe to.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const ratePlanGetResponse of client.zones.ratePlans.get(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/available_rate_plans`, RatePlanGetResponsesSinglePage, options);
    }
}
exports.RatePlans = RatePlans;
class RatePlanGetResponsesSinglePage extends pagination_1.SinglePage {
}
exports.RatePlanGetResponsesSinglePage = RatePlanGetResponsesSinglePage;
RatePlans.RatePlanGetResponsesSinglePage = RatePlanGetResponsesSinglePage;
//# sourceMappingURL=rate-plans.js.map