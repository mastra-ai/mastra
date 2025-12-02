import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class TimeseriesGroups extends APIResource {
    /**
     * Retrieves the distribution of layer 7 attacks by HTTP method over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer7.timeseriesGroups.httpMethod();
     * ```
     */
    httpMethod(query?: TimeseriesGroupHTTPMethodParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupHTTPMethodResponse>;
    httpMethod(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupHTTPMethodResponse>;
    /**
     * Retrieves the distribution of layer 7 attacks by HTTP version over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer7.timeseriesGroups.httpVersion();
     * ```
     */
    httpVersion(query?: TimeseriesGroupHTTPVersionParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupHTTPVersionResponse>;
    httpVersion(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupHTTPVersionResponse>;
    /**
     * Retrieves the distribution of layer 7 attacks by targeted industry over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer7.timeseriesGroups.industry();
     * ```
     */
    industry(query?: TimeseriesGroupIndustryParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupIndustryResponse>;
    industry(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupIndustryResponse>;
    /**
     * Retrieves the distribution of layer 7 attacks by IP version used over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer7.timeseriesGroups.ipVersion();
     * ```
     */
    ipVersion(query?: TimeseriesGroupIPVersionParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupIPVersionResponse>;
    ipVersion(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupIPVersionResponse>;
    /**
     * Retrieves the distribution of layer 7 attacks by managed rules over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer7.timeseriesGroups.managedRules();
     * ```
     */
    managedRules(query?: TimeseriesGroupManagedRulesParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupManagedRulesResponse>;
    managedRules(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupManagedRulesResponse>;
    /**
     * Retrieves the distribution of layer 7 attacks by mitigation product over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer7.timeseriesGroups.mitigationProduct();
     * ```
     */
    mitigationProduct(query?: TimeseriesGroupMitigationProductParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupMitigationProductResponse>;
    mitigationProduct(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupMitigationProductResponse>;
    /**
     * Retrieves the distribution of layer 7 attacks by targeted vertical over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer7.timeseriesGroups.vertical();
     * ```
     */
    vertical(query?: TimeseriesGroupVerticalParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupVerticalResponse>;
    vertical(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupVerticalResponse>;
}
export interface TimeseriesGroupHTTPMethodResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupHTTPMethodResponse.Meta;
    serie_0: TimeseriesGroupHTTPMethodResponse.Serie0;
}
export declare namespace TimeseriesGroupHTTPMethodResponse {
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
        [k: string]: Array<string> | Array<string> | undefined;
    }
}
export interface TimeseriesGroupHTTPVersionResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupHTTPVersionResponse.Meta;
    serie_0: TimeseriesGroupHTTPVersionResponse.Serie0;
}
export declare namespace TimeseriesGroupHTTPVersionResponse {
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
        'HTTP/1.x': Array<string>;
        'HTTP/2': Array<string>;
        'HTTP/3': Array<string>;
        timestamps: Array<string>;
    }
}
export interface TimeseriesGroupIndustryResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupIndustryResponse.Meta;
    serie_0: TimeseriesGroupIndustryResponse.Serie0;
}
export declare namespace TimeseriesGroupIndustryResponse {
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
        [k: string]: Array<string> | Array<string> | undefined;
    }
}
export interface TimeseriesGroupIPVersionResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupIPVersionResponse.Meta;
    serie_0: TimeseriesGroupIPVersionResponse.Serie0;
}
export declare namespace TimeseriesGroupIPVersionResponse {
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
        IPv4: Array<string>;
        IPv6: Array<string>;
        timestamps: Array<string>;
    }
}
export interface TimeseriesGroupManagedRulesResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupManagedRulesResponse.Meta;
    serie_0: TimeseriesGroupManagedRulesResponse.Serie0;
}
export declare namespace TimeseriesGroupManagedRulesResponse {
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
        [k: string]: Array<string> | Array<string> | undefined;
    }
}
export interface TimeseriesGroupMitigationProductResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupMitigationProductResponse.Meta;
    serie_0: TimeseriesGroupMitigationProductResponse.Serie0;
}
export declare namespace TimeseriesGroupMitigationProductResponse {
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
        [k: string]: Array<string> | Array<string> | undefined;
    }
}
export interface TimeseriesGroupVerticalResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupVerticalResponse.Meta;
    serie_0: TimeseriesGroupVerticalResponse.Serie0;
}
export declare namespace TimeseriesGroupVerticalResponse {
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
        [k: string]: Array<string> | Array<string> | undefined;
    }
}
export interface TimeseriesGroupHTTPMethodParams {
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
     * Filters results by HTTP version.
     */
    httpVersion?: Array<'HTTPv1' | 'HTTPv2' | 'HTTPv3'>;
    /**
     * Filters results by IP version (Ipv4 vs. IPv6).
     */
    ipVersion?: Array<'IPv4' | 'IPv6'>;
    /**
     * Limits the number of objects per group to the top items within the specified
     * time range. When item count exceeds the limit, extra items appear grouped under
     * an "other" category.
     */
    limitPerGroup?: number;
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
    /**
     * Normalization method applied to the results. Refer to
     * [Normalization methods](https://developers.cloudflare.com/radar/concepts/normalization/).
     */
    normalization?: 'PERCENTAGE' | 'MIN0_MAX';
}
export interface TimeseriesGroupHTTPVersionParams {
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
     * Filters results by HTTP method.
     */
    httpMethod?: Array<'GET' | 'POST' | 'DELETE' | 'PUT' | 'HEAD' | 'PURGE' | 'OPTIONS' | 'PROPFIND' | 'MKCOL' | 'PATCH' | 'ACL' | 'BCOPY' | 'BDELETE' | 'BMOVE' | 'BPROPFIND' | 'BPROPPATCH' | 'CHECKIN' | 'CHECKOUT' | 'CONNECT' | 'COPY' | 'LABEL' | 'LOCK' | 'MERGE' | 'MKACTIVITY' | 'MKWORKSPACE' | 'MOVE' | 'NOTIFY' | 'ORDERPATCH' | 'POLL' | 'PROPPATCH' | 'REPORT' | 'SEARCH' | 'SUBSCRIBE' | 'TRACE' | 'UNCHECKOUT' | 'UNLOCK' | 'UNSUBSCRIBE' | 'UPDATE' | 'VERSIONCONTROL' | 'BASELINECONTROL' | 'XMSENUMATTS' | 'RPC_OUT_DATA' | 'RPC_IN_DATA' | 'JSON' | 'COOK' | 'TRACK'>;
    /**
     * Filters results by IP version (Ipv4 vs. IPv6).
     */
    ipVersion?: Array<'IPv4' | 'IPv6'>;
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
    /**
     * Normalization method applied to the results. Refer to
     * [Normalization methods](https://developers.cloudflare.com/radar/concepts/normalization/).
     */
    normalization?: 'PERCENTAGE' | 'MIN0_MAX';
}
export interface TimeseriesGroupIndustryParams {
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
     * Limits the number of objects per group to the top items within the specified
     * time range. When item count exceeds the limit, extra items appear grouped under
     * an "other" category.
     */
    limitPerGroup?: number;
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
    /**
     * Normalization method applied to the results. Refer to
     * [Normalization methods](https://developers.cloudflare.com/radar/concepts/normalization/).
     */
    normalization?: 'PERCENTAGE' | 'MIN0_MAX';
}
export interface TimeseriesGroupIPVersionParams {
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
     * Filters results by HTTP method.
     */
    httpMethod?: Array<'GET' | 'POST' | 'DELETE' | 'PUT' | 'HEAD' | 'PURGE' | 'OPTIONS' | 'PROPFIND' | 'MKCOL' | 'PATCH' | 'ACL' | 'BCOPY' | 'BDELETE' | 'BMOVE' | 'BPROPFIND' | 'BPROPPATCH' | 'CHECKIN' | 'CHECKOUT' | 'CONNECT' | 'COPY' | 'LABEL' | 'LOCK' | 'MERGE' | 'MKACTIVITY' | 'MKWORKSPACE' | 'MOVE' | 'NOTIFY' | 'ORDERPATCH' | 'POLL' | 'PROPPATCH' | 'REPORT' | 'SEARCH' | 'SUBSCRIBE' | 'TRACE' | 'UNCHECKOUT' | 'UNLOCK' | 'UNSUBSCRIBE' | 'UPDATE' | 'VERSIONCONTROL' | 'BASELINECONTROL' | 'XMSENUMATTS' | 'RPC_OUT_DATA' | 'RPC_IN_DATA' | 'JSON' | 'COOK' | 'TRACK'>;
    /**
     * Filters results by HTTP version.
     */
    httpVersion?: Array<'HTTPv1' | 'HTTPv2' | 'HTTPv3'>;
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
    /**
     * Normalization method applied to the results. Refer to
     * [Normalization methods](https://developers.cloudflare.com/radar/concepts/normalization/).
     */
    normalization?: 'PERCENTAGE' | 'MIN0_MAX';
}
export interface TimeseriesGroupManagedRulesParams {
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
     * Limits the number of objects per group to the top items within the specified
     * time range. When item count exceeds the limit, extra items appear grouped under
     * an "other" category.
     */
    limitPerGroup?: number;
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
    /**
     * Normalization method applied to the results. Refer to
     * [Normalization methods](https://developers.cloudflare.com/radar/concepts/normalization/).
     */
    normalization?: 'PERCENTAGE' | 'MIN0_MAX';
}
export interface TimeseriesGroupMitigationProductParams {
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
     * Limits the number of objects per group to the top items within the specified
     * time range. When item count exceeds the limit, extra items appear grouped under
     * an "other" category.
     */
    limitPerGroup?: number;
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
     * Normalization method applied to the results. Refer to
     * [Normalization methods](https://developers.cloudflare.com/radar/concepts/normalization/).
     */
    normalization?: 'PERCENTAGE' | 'MIN0_MAX';
}
export interface TimeseriesGroupVerticalParams {
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
     * Limits the number of objects per group to the top items within the specified
     * time range. When item count exceeds the limit, extra items appear grouped under
     * an "other" category.
     */
    limitPerGroup?: number;
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
    /**
     * Normalization method applied to the results. Refer to
     * [Normalization methods](https://developers.cloudflare.com/radar/concepts/normalization/).
     */
    normalization?: 'PERCENTAGE' | 'MIN0_MAX';
}
export declare namespace TimeseriesGroups {
    export { type TimeseriesGroupHTTPMethodResponse as TimeseriesGroupHTTPMethodResponse, type TimeseriesGroupHTTPVersionResponse as TimeseriesGroupHTTPVersionResponse, type TimeseriesGroupIndustryResponse as TimeseriesGroupIndustryResponse, type TimeseriesGroupIPVersionResponse as TimeseriesGroupIPVersionResponse, type TimeseriesGroupManagedRulesResponse as TimeseriesGroupManagedRulesResponse, type TimeseriesGroupMitigationProductResponse as TimeseriesGroupMitigationProductResponse, type TimeseriesGroupVerticalResponse as TimeseriesGroupVerticalResponse, type TimeseriesGroupHTTPMethodParams as TimeseriesGroupHTTPMethodParams, type TimeseriesGroupHTTPVersionParams as TimeseriesGroupHTTPVersionParams, type TimeseriesGroupIndustryParams as TimeseriesGroupIndustryParams, type TimeseriesGroupIPVersionParams as TimeseriesGroupIPVersionParams, type TimeseriesGroupManagedRulesParams as TimeseriesGroupManagedRulesParams, type TimeseriesGroupMitigationProductParams as TimeseriesGroupMitigationProductParams, type TimeseriesGroupVerticalParams as TimeseriesGroupVerticalParams, };
}
//# sourceMappingURL=timeseries-groups.d.ts.map