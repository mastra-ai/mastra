import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class TimeseriesGroups extends APIResource {
    /**
     * Retrieves the distribution of HTTP authentication requests by bot class over
     * time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.leakedCredentials.timeseriesGroups.botClass();
     * ```
     */
    botClass(query?: TimeseriesGroupBotClassParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupBotClassResponse>;
    botClass(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupBotClassResponse>;
    /**
     * Retrieves the distribution of HTTP authentication requests by compromised
     * credential status over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.leakedCredentials.timeseriesGroups.compromised();
     * ```
     */
    compromised(query?: TimeseriesGroupCompromisedParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupCompromisedResponse>;
    compromised(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupCompromisedResponse>;
}
export interface TimeseriesGroupBotClassResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupBotClassResponse.Meta;
    serie_0: TimeseriesGroupBotClassResponse.Serie0;
}
export declare namespace TimeseriesGroupBotClassResponse {
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
        bot: Array<string>;
        human: Array<string>;
        timestamps: Array<string>;
    }
}
export interface TimeseriesGroupCompromisedResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupCompromisedResponse.Meta;
    serie_0: TimeseriesGroupCompromisedResponse.Serie0;
}
export declare namespace TimeseriesGroupCompromisedResponse {
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
        CLEAN: Array<string>;
        COMPROMISED: Array<string>;
        timestamps: Array<string>;
    }
}
export interface TimeseriesGroupBotClassParams {
    /**
     * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
     * Refer to
     * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
     */
    aggInterval?: '15m' | '1h' | '1d' | '1w';
    /**
     * Filters results by compromised credential status (clean vs. compromised).
     */
    compromised?: Array<'CLEAN' | 'COMPROMISED'>;
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
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
}
export interface TimeseriesGroupCompromisedParams {
    /**
     * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
     * Refer to
     * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
     */
    aggInterval?: '15m' | '1h' | '1d' | '1w';
    /**
     * Filters results by bot class. Refer to
     * [Bot classes](https://developers.cloudflare.com/radar/concepts/bot-classes/).
     */
    botClass?: Array<'LIKELY_AUTOMATED' | 'LIKELY_HUMAN'>;
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
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
}
export declare namespace TimeseriesGroups {
    export { type TimeseriesGroupBotClassResponse as TimeseriesGroupBotClassResponse, type TimeseriesGroupCompromisedResponse as TimeseriesGroupCompromisedResponse, type TimeseriesGroupBotClassParams as TimeseriesGroupBotClassParams, type TimeseriesGroupCompromisedParams as TimeseriesGroupCompromisedParams, };
}
//# sourceMappingURL=timeseries-groups.d.ts.map