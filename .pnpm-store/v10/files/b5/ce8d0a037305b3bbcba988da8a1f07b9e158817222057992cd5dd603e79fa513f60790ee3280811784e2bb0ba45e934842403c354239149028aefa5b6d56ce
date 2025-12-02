import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Domain extends APIResource {
    /**
     * Retrieves domain rank details. Cloudflare provides an ordered rank for the top
     * 100 domains, but for the remainder it only provides ranking buckets like top 200
     * thousand, top one million, etc.. These are available through Radar datasets
     * endpoints.
     *
     * @example
     * ```ts
     * const domain = await client.radar.ranking.domain.get(
     *   'google.com',
     * );
     * ```
     */
    get(domain: string, query?: DomainGetParams, options?: Core.RequestOptions): Core.APIPromise<DomainGetResponse>;
    get(domain: string, options?: Core.RequestOptions): Core.APIPromise<DomainGetResponse>;
}
export interface DomainGetResponse {
    details_0: DomainGetResponse.Details0;
    meta: DomainGetResponse.Meta;
}
export declare namespace DomainGetResponse {
    interface Details0 {
        categories: Array<Details0.Category>;
        /**
         * Only available in POPULAR ranking for the most recent ranking.
         */
        bucket?: string;
        rank?: number;
        top_locations?: Array<Details0.TopLocation>;
    }
    namespace Details0 {
        interface Category {
            id: number;
            name: string;
            superCategoryId: number;
        }
        interface TopLocation {
            locationCode: string;
            locationName: string;
            rank: number;
        }
    }
    interface Meta {
        dateRange: Array<Meta.DateRange>;
    }
    namespace Meta {
        interface DateRange {
            /**
             * Adjusted end of date range.
             */
            endTime: string;
            /**
             * Adjusted start of date range.
             */
            startTime: string;
        }
    }
}
export interface DomainGetParams {
    /**
     * Filters results by the specified array of dates.
     */
    date?: Array<string>;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Includes top locations in the response.
     */
    includeTopLocations?: boolean;
    /**
     * Limits the number of objects returned in the response.
     */
    limit?: number;
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * The ranking type.
     */
    rankingType?: 'POPULAR' | 'TRENDING_RISE' | 'TRENDING_STEADY';
}
export declare namespace Domain {
    export { type DomainGetResponse as DomainGetResponse, type DomainGetParams as DomainGetParams };
}
//# sourceMappingURL=domain.d.ts.map