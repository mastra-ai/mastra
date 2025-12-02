import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as AsesAPI from "./ases.js";
import { AseGetParams, AseGetResponse, AsePrefixesParams, AsePrefixesResponse, Ases } from "./ases.js";
export declare class Top extends APIResource {
    ases: AsesAPI.Ases;
    /**
     * Retrieves the top network prefixes by BGP updates.
     *
     * @example
     * ```ts
     * const response = await client.radar.bgp.top.prefixes();
     * ```
     */
    prefixes(query?: TopPrefixesParams, options?: Core.RequestOptions): Core.APIPromise<TopPrefixesResponse>;
    prefixes(options?: Core.RequestOptions): Core.APIPromise<TopPrefixesResponse>;
}
export interface TopPrefixesResponse {
    meta: TopPrefixesResponse.Meta;
    top_0: Array<TopPrefixesResponse.Top0>;
}
export declare namespace TopPrefixesResponse {
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
    interface Top0 {
        prefix: string;
        /**
         * A numeric string.
         */
        value: string;
    }
}
export interface TopPrefixesParams {
    /**
     * Filters results by Autonomous System. Specify one or more Autonomous System
     * Numbers (ASNs) as a comma-separated list. Prefix with `-` to exclude ASNs from
     * results. For example, `-174, 3356` excludes results from AS174, but includes
     * results from AS3356.
     */
    asn?: Array<string>;
    /**
     * End of the date range (inclusive).
     */
    dateEnd?: Array<string>;
    /**
     * Filters results by date range. For example, use `7d` and `7dcontrol` to compare
     * this week with the previous week. Use this parameter or set specific start and
     * end dates (`dateStart` and `dateEnd` parameters).
     */
    dateRange?: Array<string>;
    /**
     * Start of the date range.
     */
    dateStart?: Array<string>;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Limits the number of objects returned in the response.
     */
    limit?: number;
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters results by BGP update type.
     */
    updateType?: Array<'ANNOUNCEMENT' | 'WITHDRAWAL'>;
}
export declare namespace Top {
    export { type TopPrefixesResponse as TopPrefixesResponse, type TopPrefixesParams as TopPrefixesParams };
    export { Ases as Ases, type AseGetResponse as AseGetResponse, type AsePrefixesResponse as AsePrefixesResponse, type AseGetParams as AseGetParams, type AsePrefixesParams as AsePrefixesParams, };
}
//# sourceMappingURL=top.d.ts.map