// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class RatePlans extends APIResource {
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
export class RatePlanGetResponsesSinglePage extends SinglePage {
}
RatePlans.RatePlanGetResponsesSinglePage = RatePlanGetResponsesSinglePage;
//# sourceMappingURL=rate-plans.mjs.map