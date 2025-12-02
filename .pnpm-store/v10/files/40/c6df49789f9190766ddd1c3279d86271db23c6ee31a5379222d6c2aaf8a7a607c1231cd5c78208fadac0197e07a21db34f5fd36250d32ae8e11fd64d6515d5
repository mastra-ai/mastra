import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Summary extends APIResource {
    /**
     * Retrieves the distribution of HTTP authentication requests by bot class.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.leakedCredentials.summary.botClass();
     * ```
     */
    botClass(query?: SummaryBotClassParams, options?: Core.RequestOptions): Core.APIPromise<SummaryBotClassResponse>;
    botClass(options?: Core.RequestOptions): Core.APIPromise<SummaryBotClassResponse>;
    /**
     * Retrieves the distribution of HTTP authentication requests by compromised
     * credential status.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.leakedCredentials.summary.compromised();
     * ```
     */
    compromised(query?: SummaryCompromisedParams, options?: Core.RequestOptions): Core.APIPromise<SummaryCompromisedResponse>;
    compromised(options?: Core.RequestOptions): Core.APIPromise<SummaryCompromisedResponse>;
}
export interface SummaryBotClassResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryBotClassResponse.Meta;
    summary_0: SummaryBotClassResponse.Summary0;
}
export declare namespace SummaryBotClassResponse {
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
         * A numeric string.
         */
        bot: string;
        /**
         * A numeric string.
         */
        human: string;
    }
}
export interface SummaryCompromisedResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryCompromisedResponse.Meta;
    summary_0: SummaryCompromisedResponse.Summary0;
}
export declare namespace SummaryCompromisedResponse {
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
         * A numeric string.
         */
        CLEAN: string;
        /**
         * A numeric string.
         */
        COMPROMISED: string;
    }
}
export interface SummaryBotClassParams {
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
export interface SummaryCompromisedParams {
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
export declare namespace Summary {
    export { type SummaryBotClassResponse as SummaryBotClassResponse, type SummaryCompromisedResponse as SummaryCompromisedResponse, type SummaryBotClassParams as SummaryBotClassParams, type SummaryCompromisedParams as SummaryCompromisedParams, };
}
//# sourceMappingURL=summary.d.ts.map