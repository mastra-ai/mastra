"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvailableRatePlansSinglePage = exports.Plans = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Plans extends resource_1.APIResource {
    /**
     * Lists available plans the zone can subscribe to.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const availableRatePlan of client.zones.plans.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/available_plans`, AvailableRatePlansSinglePage, options);
    }
    /**
     * Details of the available plan that the zone can subscribe to.
     *
     * @example
     * ```ts
     * const availableRatePlan = await client.zones.plans.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(planIdentifier, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/available_plans/${planIdentifier}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Plans = Plans;
class AvailableRatePlansSinglePage extends pagination_1.SinglePage {
}
exports.AvailableRatePlansSinglePage = AvailableRatePlansSinglePage;
Plans.AvailableRatePlansSinglePage = AvailableRatePlansSinglePage;
//# sourceMappingURL=plans.js.map