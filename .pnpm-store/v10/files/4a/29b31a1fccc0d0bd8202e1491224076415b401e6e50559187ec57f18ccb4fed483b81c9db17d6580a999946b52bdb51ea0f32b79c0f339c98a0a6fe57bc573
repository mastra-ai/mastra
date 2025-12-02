// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Plans extends APIResource {
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
export class AvailableRatePlansSinglePage extends SinglePage {
}
Plans.AvailableRatePlansSinglePage = AvailableRatePlansSinglePage;
//# sourceMappingURL=plans.mjs.map