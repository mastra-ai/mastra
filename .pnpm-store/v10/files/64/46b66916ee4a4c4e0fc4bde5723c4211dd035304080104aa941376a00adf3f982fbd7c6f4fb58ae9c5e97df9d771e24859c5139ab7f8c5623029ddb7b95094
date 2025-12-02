import { APIResource } from "../../../../../resource.js";
import * as Core from "../../../../../core.js";
export declare class Ases extends APIResource {
    /**
     * Retrieves the top origin autonomous systems of layer 7 attacks. Values are
     * percentages of the total layer 7 attacks, with the origin autonomous systems
     * determined by the client IP address.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer7.top.ases.origin();
     * ```
     */
    origin(query?: AseOriginParams, options?: Core.RequestOptions): Core.APIPromise<AseOriginResponse>;
    origin(options?: Core.RequestOptions): Core.APIPromise<AseOriginResponse>;
}
export interface AseOriginResponse {
    /**
     * Metadata for the results.
     */
    meta: AseOriginResponse.Meta;
    top_0: Array<AseOriginResponse.Top0>;
}
export declare namespace AseOriginResponse {
    /**
     * Metadata for the results.
     */
    interface Meta {
        confidenceInfo: Meta.ConfidenceInfo | null;
        dateRange: Array<Meta.DateRange>;
        /**
         * Timestamp of the last dataset update.
         */
        lastUpdated: string;
        /**
         * Normalization method applied to the results. Refer to
         * [Normalization methods](https://developers.cloudflare.com/radar/concepts/normalization/).
         */
        normalization: 'PERCENTAGE' | 'MIN0_MAX' | 'MIN_MAX' | 'RAW_VALUES' | 'PERCENTAGE_CHANGE' | 'ROLLING_AVERAGE' | 'OVERLAPPED_PERCENTAGE' | 'RATIO';
        /**
         * Measurement units for the results.
         */
        units: Array<Meta.Unit>;
    }
    namespace Meta {
        interface ConfidenceInfo {
            annotations: Array<ConfidenceInfo.Annotation>;
            /**
             * Provides an indication of how much confidence Cloudflare has in the data.
             */
            level: number;
        }
        namespace ConfidenceInfo {
            /**
             * Annotation associated with the result (e.g. outage or other type of event).
             */
            interface Annotation {
                dataSource: string;
                description: string;
                endDate: string;
                eventType: string;
                /**
                 * Whether event is a single point in time or a time range.
                 */
                isInstantaneous: boolean;
                linkedUrl: string;
                startDate: string;
            }
        }
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
        interface Unit {
            name: string;
            value: string;
        }
    }
    interface Top0 {
        originAsn: string;
        originAsnName: string;
        rank: number;
        value: string;
    }
}
export interface AseOriginParams {
    /**
     * Filters results by continent. Specify a comma-separated list of alpha-2 codes.
     * Prefix with `-` to exclude continents from results. For example, `-EU,NA`
     * excludes results from EU, but includes results from NA.
     */
    continent?: Array<string>;
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
     * Filters results by HTTP method.
     */
    httpMethod?: Array<'GET' | 'POST' | 'DELETE' | 'PUT' | 'HEAD' | 'PURGE' | 'OPTIONS' | 'PROPFIND' | 'MKCOL' | 'PATCH' | 'ACL' | 'BCOPY' | 'BDELETE' | 'BMOVE' | 'BPROPFIND' | 'BPROPPATCH' | 'CHECKIN' | 'CHECKOUT' | 'CONNECT' | 'COPY' | 'LABEL' | 'LOCK' | 'MERGE' | 'MKACTIVITY' | 'MKWORKSPACE' | 'MOVE' | 'NOTIFY' | 'ORDERPATCH' | 'POLL' | 'PROPPATCH' | 'REPORT' | 'SEARCH' | 'SUBSCRIBE' | 'TRACE' | 'UNCHECKOUT' | 'UNLOCK' | 'UNSUBSCRIBE' | 'UPDATE' | 'VERSIONCONTROL' | 'BASELINECONTROL' | 'XMSENUMATTS' | 'RPC_OUT_DATA' | 'RPC_IN_DATA' | 'JSON' | 'COOK' | 'TRACK'>;
    /**
     * Filters results by HTTP version.
     */
    httpVersion?: Array<'HTTPv1' | 'HTTPv2' | 'HTTPv3'>;
    /**
     * Filters results by IP version (Ipv4 vs. IPv6).
     */
    ipVersion?: Array<'IPv4' | 'IPv6'>;
    /**
     * Limits the number of objects returned in the response.
     */
    limit?: number;
    /**
     * Filters results by location. Specify a comma-separated list of alpha-2 codes.
     * Prefix with `-` to exclude locations from results. For example, `-US,PT`
     * excludes results from the US, but includes results from PT.
     */
    location?: Array<string>;
    /**
     * Filters the results by layer 7 mitigation product.
     */
    mitigationProduct?: Array<'DDOS' | 'WAF' | 'BOT_MANAGEMENT' | 'ACCESS_RULES' | 'IP_REPUTATION' | 'API_SHIELD' | 'DATA_LOSS_PREVENTION'>;
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
}
export declare namespace Ases {
    export { type AseOriginResponse as AseOriginResponse, type AseOriginParams as AseOriginParams };
}
//# sourceMappingURL=ases.d.ts.map