import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class Top extends APIResource {
    /**
     * Retrieves the top autonomous systems by bandwidth, latency, jitter, or packet
     * loss, from the previous 90 days of Cloudflare Speed Test data.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.quality.speed.top.ases();
     * ```
     */
    ases(query?: TopAsesParams, options?: Core.RequestOptions): Core.APIPromise<TopAsesResponse>;
    ases(options?: Core.RequestOptions): Core.APIPromise<TopAsesResponse>;
    /**
     * Retrieves the top locations by bandwidth, latency, jitter, or packet loss, from
     * the previous 90 days of Cloudflare Speed Test data.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.quality.speed.top.locations();
     * ```
     */
    locations(query?: TopLocationsParams, options?: Core.RequestOptions): Core.APIPromise<TopLocationsResponse>;
    locations(options?: Core.RequestOptions): Core.APIPromise<TopLocationsResponse>;
}
export interface TopAsesResponse {
    /**
     * Metadata for the results.
     */
    meta: TopAsesResponse.Meta;
    top_0: Array<TopAsesResponse.Top0>;
}
export declare namespace TopAsesResponse {
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
        bandwidthDownload: string;
        bandwidthUpload: string;
        clientASN: number;
        clientASName: string;
        jitterIdle: string;
        jitterLoaded: string;
        latencyIdle: string;
        latencyLoaded: string;
        numTests: number;
        rankPower: number;
    }
}
export interface TopLocationsResponse {
    /**
     * Metadata for the results.
     */
    meta: TopLocationsResponse.Meta;
    top_0: Array<TopLocationsResponse.Top0>;
}
export declare namespace TopLocationsResponse {
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
        bandwidthDownload: string;
        bandwidthUpload: string;
        clientCountryAlpha2: string;
        clientCountryName: string;
        jitterIdle: string;
        jitterLoaded: string;
        latencyIdle: string;
        latencyLoaded: string;
        numTests: number;
        rankPower: number;
    }
}
export interface TopAsesParams {
    /**
     * Filters results by Autonomous System. Specify one or more Autonomous System
     * Numbers (ASNs) as a comma-separated list. Prefix with `-` to exclude ASNs from
     * results. For example, `-174, 3356` excludes results from AS174, but includes
     * results from AS3356.
     */
    asn?: Array<string>;
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
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
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
     * Specifies the metric to order the results by.
     */
    orderBy?: 'BANDWIDTH_DOWNLOAD' | 'BANDWIDTH_UPLOAD' | 'LATENCY_IDLE' | 'LATENCY_LOADED' | 'JITTER_IDLE' | 'JITTER_LOADED';
    /**
     * Reverses the order of results.
     */
    reverse?: boolean;
}
export interface TopLocationsParams {
    /**
     * Filters results by Autonomous System. Specify one or more Autonomous System
     * Numbers (ASNs) as a comma-separated list. Prefix with `-` to exclude ASNs from
     * results. For example, `-174, 3356` excludes results from AS174, but includes
     * results from AS3356.
     */
    asn?: Array<string>;
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
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
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
     * Specifies the metric to order the results by.
     */
    orderBy?: 'BANDWIDTH_DOWNLOAD' | 'BANDWIDTH_UPLOAD' | 'LATENCY_IDLE' | 'LATENCY_LOADED' | 'JITTER_IDLE' | 'JITTER_LOADED';
    /**
     * Reverses the order of results.
     */
    reverse?: boolean;
}
export declare namespace Top {
    export { type TopAsesResponse as TopAsesResponse, type TopLocationsResponse as TopLocationsResponse, type TopAsesParams as TopAsesParams, type TopLocationsParams as TopLocationsParams, };
}
//# sourceMappingURL=top.d.ts.map