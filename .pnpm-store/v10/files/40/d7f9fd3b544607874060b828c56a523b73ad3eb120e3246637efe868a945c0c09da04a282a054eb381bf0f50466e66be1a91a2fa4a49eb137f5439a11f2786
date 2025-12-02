import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class TCPResetsTimeouts extends APIResource {
    /**
     * Retrieves the distribution of connection stage by TCP connections terminated
     * within the first 10 packets by a reset or timeout.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.tcpResetsTimeouts.summary();
     * ```
     */
    summary(query?: TCPResetsTimeoutSummaryParams, options?: Core.RequestOptions): Core.APIPromise<TCPResetsTimeoutSummaryResponse>;
    summary(options?: Core.RequestOptions): Core.APIPromise<TCPResetsTimeoutSummaryResponse>;
    /**
     * Retrieves the distribution of connection stage by TCP connections terminated
     * within the first 10 packets by a reset or timeout over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.tcpResetsTimeouts.timeseriesGroups();
     * ```
     */
    timeseriesGroups(query?: TCPResetsTimeoutTimeseriesGroupsParams, options?: Core.RequestOptions): Core.APIPromise<TCPResetsTimeoutTimeseriesGroupsResponse>;
    timeseriesGroups(options?: Core.RequestOptions): Core.APIPromise<TCPResetsTimeoutTimeseriesGroupsResponse>;
}
export interface TCPResetsTimeoutSummaryResponse {
    /**
     * Metadata for the results.
     */
    meta: TCPResetsTimeoutSummaryResponse.Meta;
    summary_0: TCPResetsTimeoutSummaryResponse.Summary0;
}
export declare namespace TCPResetsTimeoutSummaryResponse {
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
        /**
         * Connection resets within the first 10 packets from the client, but after the
         * server has received multiple data packets.
         */
        later_in_flow: string;
        /**
         * All other connections.
         */
        no_match: string;
        /**
         * Connection resets or timeouts after the server received both a SYN packet and an
         * ACK packet, meaning the connection was successfully established.
         */
        post_ack: string;
        /**
         * Connection resets or timeouts after the server received a packet with PSH flag
         * set, following connection establishment.
         */
        post_psh: string;
        /**
         * Connection resets or timeouts after the server received only a single SYN
         * packet.
         */
        post_syn: string;
    }
}
export interface TCPResetsTimeoutTimeseriesGroupsResponse {
    /**
     * Metadata for the results.
     */
    meta: TCPResetsTimeoutTimeseriesGroupsResponse.Meta;
    serie_0: TCPResetsTimeoutTimeseriesGroupsResponse.Serie0;
}
export declare namespace TCPResetsTimeoutTimeseriesGroupsResponse {
    /**
     * Metadata for the results.
     */
    interface Meta {
        /**
         * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
         * Refer to
         * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
         */
        aggInterval: 'FIFTEEN_MINUTES' | 'ONE_HOUR' | 'ONE_DAY' | 'ONE_WEEK' | 'ONE_MONTH';
        confidenceInfo: Meta.ConfidenceInfo;
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
    interface Serie0 {
        later_in_flow: Array<string>;
        no_match: Array<string>;
        post_ack: Array<string>;
        post_psh: Array<string>;
        post_syn: Array<string>;
        timestamps: Array<string>;
    }
}
export interface TCPResetsTimeoutSummaryParams {
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
export interface TCPResetsTimeoutTimeseriesGroupsParams {
    /**
     * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
     * Refer to
     * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
     */
    aggInterval?: '15m' | '1h' | '1d' | '1w';
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
export declare namespace TCPResetsTimeouts {
    export { type TCPResetsTimeoutSummaryResponse as TCPResetsTimeoutSummaryResponse, type TCPResetsTimeoutTimeseriesGroupsResponse as TCPResetsTimeoutTimeseriesGroupsResponse, type TCPResetsTimeoutSummaryParams as TCPResetsTimeoutSummaryParams, type TCPResetsTimeoutTimeseriesGroupsParams as TCPResetsTimeoutTimeseriesGroupsParams, };
}
//# sourceMappingURL=tcp-resets-timeouts.d.ts.map