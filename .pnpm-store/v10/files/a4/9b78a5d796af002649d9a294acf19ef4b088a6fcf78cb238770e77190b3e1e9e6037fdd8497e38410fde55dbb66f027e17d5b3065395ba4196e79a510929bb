import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as TopAPI from "./top.js";
import { Top, TopAsesParams, TopAsesResponse, TopLocationsParams, TopLocationsResponse } from "./top.js";
export declare class Speed extends APIResource {
    top: TopAPI.Top;
    /**
     * Retrieves a histogram from the previous 90 days of Cloudflare Speed Test data,
     * split into fixed bandwidth (Mbps), latency (ms), or jitter (ms) buckets.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.quality.speed.histogram();
     * ```
     */
    histogram(query?: SpeedHistogramParams, options?: Core.RequestOptions): Core.APIPromise<SpeedHistogramResponse>;
    histogram(options?: Core.RequestOptions): Core.APIPromise<SpeedHistogramResponse>;
    /**
     * Retrieves a summary of bandwidth, latency, jitter, and packet loss, from the
     * previous 90 days of Cloudflare Speed Test data.
     *
     * @example
     * ```ts
     * const response = await client.radar.quality.speed.summary();
     * ```
     */
    summary(query?: SpeedSummaryParams, options?: Core.RequestOptions): Core.APIPromise<SpeedSummaryResponse>;
    summary(options?: Core.RequestOptions): Core.APIPromise<SpeedSummaryResponse>;
}
export interface SpeedHistogramResponse {
    histogram_0: SpeedHistogramResponse.Histogram0;
    /**
     * Metadata for the results.
     */
    meta: SpeedHistogramResponse.Meta;
}
export declare namespace SpeedHistogramResponse {
    interface Histogram0 {
        bandwidthDownload: Array<string>;
        bandwidthUpload: Array<string>;
        bucketMin: Array<string>;
    }
    /**
     * Metadata for the results.
     */
    interface Meta {
        /**
         * The width for every bucket in the histogram.
         */
        bucketSize: number;
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
        totalTests: Array<number>;
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
}
export interface SpeedSummaryResponse {
    /**
     * Metadata for the results.
     */
    meta: SpeedSummaryResponse.Meta;
    summary_0: SpeedSummaryResponse.Summary0;
}
export declare namespace SpeedSummaryResponse {
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
    interface Summary0 {
        bandwidthDownload: string;
        bandwidthUpload: string;
        jitterIdle: string;
        jitterLoaded: string;
        latencyIdle: string;
        latencyLoaded: string;
        packetLoss: string;
    }
}
export interface SpeedHistogramParams {
    /**
     * Filters results by Autonomous System. Specify one or more Autonomous System
     * Numbers (ASNs) as a comma-separated list. Prefix with `-` to exclude ASNs from
     * results. For example, `-174, 3356` excludes results from AS174, but includes
     * results from AS3356.
     */
    asn?: Array<string>;
    /**
     * Specifies the width for every bucket in the histogram.
     */
    bucketSize?: number;
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
     * Filters results by location. Specify a comma-separated list of alpha-2 codes.
     * Prefix with `-` to exclude locations from results. For example, `-US,PT`
     * excludes results from the US, but includes results from PT.
     */
    location?: Array<string>;
    /**
     * Metrics to be returned.
     */
    metricGroup?: 'BANDWIDTH' | 'LATENCY' | 'JITTER';
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
}
export interface SpeedSummaryParams {
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
     * Filters results by location. Specify a comma-separated list of alpha-2 codes.
     * Prefix with `-` to exclude locations from results. For example, `-US,PT`
     * excludes results from the US, but includes results from PT.
     */
    location?: Array<string>;
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
}
export declare namespace Speed {
    export { type SpeedHistogramResponse as SpeedHistogramResponse, type SpeedSummaryResponse as SpeedSummaryResponse, type SpeedHistogramParams as SpeedHistogramParams, type SpeedSummaryParams as SpeedSummaryParams, };
    export { Top as Top, type TopAsesResponse as TopAsesResponse, type TopLocationsResponse as TopLocationsResponse, type TopAsesParams as TopAsesParams, type TopLocationsParams as TopLocationsParams, };
}
//# sourceMappingURL=speed.d.ts.map