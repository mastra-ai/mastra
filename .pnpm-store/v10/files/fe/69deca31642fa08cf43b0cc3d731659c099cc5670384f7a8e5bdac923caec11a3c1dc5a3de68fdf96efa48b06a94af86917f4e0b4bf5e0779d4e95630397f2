import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class IPVersion extends APIResource {
    /**
     * Retrieves the top locations, by HTTP requests, of the requested IP version.
     *
     * @example
     * ```ts
     * const ipVersion =
     *   await client.radar.http.locations.ipVersion.get('IPv4');
     * ```
     */
    get(ipVersion: 'IPv4' | 'IPv6', query?: IPVersionGetParams, options?: Core.RequestOptions): Core.APIPromise<IPVersionGetResponse>;
    get(ipVersion: 'IPv4' | 'IPv6', options?: Core.RequestOptions): Core.APIPromise<IPVersionGetResponse>;
}
export interface IPVersionGetResponse {
    /**
     * Metadata for the results.
     */
    meta: IPVersionGetResponse.Meta;
    top_0: Array<IPVersionGetResponse.Top0>;
}
export declare namespace IPVersionGetResponse {
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
        clientCountryAlpha2: string;
        clientCountryName: string;
        /**
         * A numeric string.
         */
        value: string;
    }
}
export interface IPVersionGetParams {
    /**
     * Filters results by Autonomous System. Specify one or more Autonomous System
     * Numbers (ASNs) as a comma-separated list. Prefix with `-` to exclude ASNs from
     * results. For example, `-174, 3356` excludes results from AS174, but includes
     * results from AS3356.
     */
    asn?: Array<string>;
    /**
     * Filters results by bot class. Refer to
     * [Bot classes](https://developers.cloudflare.com/radar/concepts/bot-classes/).
     */
    botClass?: Array<'LIKELY_AUTOMATED' | 'LIKELY_HUMAN'>;
    /**
     * Filters results by browser family.
     */
    browserFamily?: Array<'CHROME' | 'EDGE' | 'FIREFOX' | 'SAFARI'>;
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
     * Filters results by device type.
     */
    deviceType?: Array<'DESKTOP' | 'MOBILE' | 'OTHER'>;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Filters results by HTTP protocol (HTTP vs. HTTPS).
     */
    httpProtocol?: Array<'HTTP' | 'HTTPS'>;
    /**
     * Filters results by HTTP version.
     */
    httpVersion?: Array<'HTTPv1' | 'HTTPv2' | 'HTTPv3'>;
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
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters results by operating system.
     */
    os?: Array<'WINDOWS' | 'MACOSX' | 'IOS' | 'ANDROID' | 'CHROMEOS' | 'LINUX' | 'SMART_TV'>;
    /**
     * Filters results by TLS version.
     */
    tlsVersion?: Array<'TLSv1_0' | 'TLSv1_1' | 'TLSv1_2' | 'TLSv1_3' | 'TLSvQUIC'>;
}
export declare namespace IPVersion {
    export { type IPVersionGetResponse as IPVersionGetResponse, type IPVersionGetParams as IPVersionGetParams };
}
//# sourceMappingURL=ip-version.d.ts.map