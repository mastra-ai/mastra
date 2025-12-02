import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Recommendations extends APIResource {
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
    get(params: RecommendationGetParams, options?: Core.RequestOptions): Core.APIPromise<RecommendationGetResponse>;
}
export interface RecommendationGetResponse {
    /**
     * Identifier of a recommendation result.
     */
    id?: string;
    modified_on?: string;
    value?: 'flexible' | 'full' | 'strict';
}
export interface RecommendationGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace Recommendations {
    export { type RecommendationGetResponse as RecommendationGetResponse, type RecommendationGetParams as RecommendationGetParams, };
}
//# sourceMappingURL=recommendations.d.ts.map