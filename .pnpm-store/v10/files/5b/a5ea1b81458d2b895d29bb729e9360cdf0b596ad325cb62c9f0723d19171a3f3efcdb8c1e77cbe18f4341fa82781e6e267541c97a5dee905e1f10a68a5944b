import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class RatePlans extends APIResource {
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
    get(params: RatePlanGetParams, options?: Core.RequestOptions): Core.PagePromise<RatePlanGetResponsesSinglePage, RatePlanGetResponse>;
}
export declare class RatePlanGetResponsesSinglePage extends SinglePage<RatePlanGetResponse> {
}
export interface RatePlanGetResponse {
    /**
     * Plan identifier tag.
     */
    id?: string;
    /**
     * Array of available components values for the plan.
     */
    components?: Array<RatePlanGetResponse.Component>;
    /**
     * The monetary unit in which pricing information is displayed.
     */
    currency?: string;
    /**
     * The duration of the plan subscription.
     */
    duration?: number;
    /**
     * The frequency at which you will be billed for this plan.
     */
    frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    /**
     * The plan name.
     */
    name?: string;
}
export declare namespace RatePlanGetResponse {
    interface Component {
        /**
         * The default amount allocated.
         */
        default?: number;
        /**
         * The unique component.
         */
        name?: 'zones' | 'page_rules' | 'dedicated_certificates' | 'dedicated_certificates_custom';
        /**
         * The unit price of the addon.
         */
        unit_price?: number;
    }
}
export interface RatePlanGetParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export declare namespace RatePlans {
    export { type RatePlanGetResponse as RatePlanGetResponse, RatePlanGetResponsesSinglePage as RatePlanGetResponsesSinglePage, type RatePlanGetParams as RatePlanGetParams, };
}
//# sourceMappingURL=rate-plans.d.ts.map