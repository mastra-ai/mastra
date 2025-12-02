import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class InternetServices extends APIResource {
    /**
     * Retrieves the list of Internet services categories.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.ranking.internetServices.categories();
     * ```
     */
    categories(query?: InternetServiceCategoriesParams, options?: Core.RequestOptions): Core.APIPromise<InternetServiceCategoriesResponse>;
    categories(options?: Core.RequestOptions): Core.APIPromise<InternetServiceCategoriesResponse>;
    /**
     * Retrieves Internet Services rank update changes over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.ranking.internetServices.timeseriesGroups();
     * ```
     */
    timeseriesGroups(query?: InternetServiceTimeseriesGroupsParams, options?: Core.RequestOptions): Core.APIPromise<InternetServiceTimeseriesGroupsResponse>;
    timeseriesGroups(options?: Core.RequestOptions): Core.APIPromise<InternetServiceTimeseriesGroupsResponse>;
    /**
     * Retrieves top Internet services based on their rank.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.ranking.internetServices.top();
     * ```
     */
    top(query?: InternetServiceTopParams, options?: Core.RequestOptions): Core.APIPromise<InternetServiceTopResponse>;
    top(options?: Core.RequestOptions): Core.APIPromise<InternetServiceTopResponse>;
}
export interface InternetServiceCategoriesResponse {
    categories_0: Array<InternetServiceCategoriesResponse.Categories0>;
}
export declare namespace InternetServiceCategoriesResponse {
    interface Categories0 {
        name: string;
    }
}
export interface InternetServiceTimeseriesGroupsResponse {
    /**
     * Metadata for the results.
     */
    meta: InternetServiceTimeseriesGroupsResponse.Meta;
    serie_0: InternetServiceTimeseriesGroupsResponse.Serie0;
}
export declare namespace InternetServiceTimeseriesGroupsResponse {
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
        timestamps: Array<string>;
        [k: string]: Array<string | number> | Array<string> | undefined;
    }
}
export interface InternetServiceTopResponse {
    meta: InternetServiceTopResponse.Meta;
    top_0: Array<InternetServiceTopResponse.Top0>;
}
export declare namespace InternetServiceTopResponse {
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
        rank: number;
        service: string;
    }
}
export interface InternetServiceCategoriesParams {
    /**
     * Filters results by the specified array of dates.
     */
    date?: Array<string>;
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
}
export interface InternetServiceTimeseriesGroupsParams {
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
     * Filters results by Internet service category.
     */
    serviceCategory?: Array<string>;
}
export interface InternetServiceTopParams {
    /**
     * Filters results by the specified array of dates.
     */
    date?: Array<string>;
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
     * Filters results by Internet service category.
     */
    serviceCategory?: Array<string>;
}
export declare namespace InternetServices {
    export { type InternetServiceCategoriesResponse as InternetServiceCategoriesResponse, type InternetServiceTimeseriesGroupsResponse as InternetServiceTimeseriesGroupsResponse, type InternetServiceTopResponse as InternetServiceTopResponse, type InternetServiceCategoriesParams as InternetServiceCategoriesParams, type InternetServiceTimeseriesGroupsParams as InternetServiceTimeseriesGroupsParams, type InternetServiceTopParams as InternetServiceTopParams, };
}
//# sourceMappingURL=internet-services.d.ts.map