import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class Ases extends APIResource {
    /**
     * Retrieves the top autonomous systems by BGP updates (announcements only).
     *
     * @example
     * ```ts
     * const ase = await client.radar.bgp.top.ases.get();
     * ```
     */
    get(query?: AseGetParams, options?: Core.RequestOptions): Core.APIPromise<AseGetResponse>;
    get(options?: Core.RequestOptions): Core.APIPromise<AseGetResponse>;
    /**
     * Retrieves the full list of autonomous systems on the global routing table
     * ordered by announced prefixes count. The data comes from public BGP MRT data
     * archives and updates every 2 hours.
     *
     * @example
     * ```ts
     * const response = await client.radar.bgp.top.ases.prefixes();
     * ```
     */
    prefixes(query?: AsePrefixesParams, options?: Core.RequestOptions): Core.APIPromise<AsePrefixesResponse>;
    prefixes(options?: Core.RequestOptions): Core.APIPromise<AsePrefixesResponse>;
}
export interface AseGetResponse {
    meta: AseGetResponse.Meta;
    top_0: Array<AseGetResponse.Top0>;
}
export declare namespace AseGetResponse {
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
        asn: number;
        ASName: string;
        /**
         * Percentage of updates by this AS out of the total updates by all autonomous
         * systems.
         */
        value: string;
    }
}
export interface AsePrefixesResponse {
    asns: Array<AsePrefixesResponse.ASN>;
    meta: AsePrefixesResponse.Meta;
}
export declare namespace AsePrefixesResponse {
    interface ASN {
        asn: number;
        country: string;
        name: string;
        pfxs_count: number;
    }
    interface Meta {
        data_time: string;
        query_time: string;
        total_peers: number;
    }
}
export interface AseGetParams {
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
     * Filters results by BGP network prefix.
     */
    prefix?: Array<string>;
    /**
     * Filters results by BGP update type.
     */
    updateType?: Array<'ANNOUNCEMENT' | 'WITHDRAWAL'>;
}
export interface AsePrefixesParams {
    /**
     * Alpha-2 country code.
     */
    country?: string;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Maximum number of ASes to return.
     */
    limit?: number;
}
export declare namespace Ases {
    export { type AseGetResponse as AseGetResponse, type AsePrefixesResponse as AsePrefixesResponse, type AseGetParams as AseGetParams, type AsePrefixesParams as AsePrefixesParams, };
}
//# sourceMappingURL=ases.d.ts.map