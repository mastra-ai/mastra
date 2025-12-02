import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class TimeseriesGroups extends APIResource {
    /**
     * Retrieves the distribution of DNS queries by cache status over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.dns.timeseriesGroups.cacheHit();
     * ```
     */
    cacheHit(query?: TimeseriesGroupCacheHitParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupCacheHitResponse>;
    cacheHit(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupCacheHitResponse>;
    /**
     * Retrieves the distribution of DNS responses by DNSSEC (DNS Security Extensions)
     * support over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.dns.timeseriesGroups.dnssec();
     * ```
     */
    dnssec(query?: TimeseriesGroupDNSSECParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupDNSSECResponse>;
    dnssec(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupDNSSECResponse>;
    /**
     * Retrieves the distribution of DNS queries by DNSSEC (DNS Security Extensions)
     * client awareness over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.dns.timeseriesGroups.dnssecAware();
     * ```
     */
    dnssecAware(query?: TimeseriesGroupDNSSECAwareParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupDNSSECAwareResponse>;
    dnssecAware(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupDNSSECAwareResponse>;
    /**
     * Retrieves the distribution of DNSSEC-validated answers by end-to-end security
     * status over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.dns.timeseriesGroups.dnssecE2E();
     * ```
     */
    dnssecE2E(query?: TimeseriesGroupDNSSECE2EParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupDNSSECE2EResponse>;
    dnssecE2E(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupDNSSECE2EResponse>;
    /**
     * Retrieves the distribution of DNS queries by IP version over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.dns.timeseriesGroups.ipVersion();
     * ```
     */
    ipVersion(query?: TimeseriesGroupIPVersionParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupIPVersionResponse>;
    ipVersion(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupIPVersionResponse>;
    /**
     * Retrieves the distribution of DNS queries by matching answers over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.dns.timeseriesGroups.matchingAnswer();
     * ```
     */
    matchingAnswer(query?: TimeseriesGroupMatchingAnswerParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupMatchingAnswerResponse>;
    matchingAnswer(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupMatchingAnswerResponse>;
    /**
     * Retrieves the distribution of DNS queries by DNS transport protocol over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.dns.timeseriesGroups.protocol();
     * ```
     */
    protocol(query?: TimeseriesGroupProtocolParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupProtocolResponse>;
    protocol(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupProtocolResponse>;
    /**
     * Retrieves the distribution of DNS queries by type over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.dns.timeseriesGroups.queryType();
     * ```
     */
    queryType(query?: TimeseriesGroupQueryTypeParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupQueryTypeResponse>;
    queryType(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupQueryTypeResponse>;
    /**
     * Retrieves the distribution of DNS queries by response code over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.dns.timeseriesGroups.responseCode();
     * ```
     */
    responseCode(query?: TimeseriesGroupResponseCodeParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupResponseCodeResponse>;
    responseCode(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupResponseCodeResponse>;
    /**
     * Retrieves the distribution of DNS queries by minimum answer TTL over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.dns.timeseriesGroups.responseTTL();
     * ```
     */
    responseTTL(query?: TimeseriesGroupResponseTTLParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupResponseTTLResponse>;
    responseTTL(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupResponseTTLResponse>;
}
export interface TimeseriesGroupCacheHitResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupCacheHitResponse.Meta;
    serie_0: TimeseriesGroupCacheHitResponse.Serie0;
}
export declare namespace TimeseriesGroupCacheHitResponse {
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
        NEGATIVE: Array<string>;
        POSITIVE: Array<string>;
    }
}
export interface TimeseriesGroupDNSSECResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupDNSSECResponse.Meta;
    serie_0: TimeseriesGroupDNSSECResponse.Serie0;
}
export declare namespace TimeseriesGroupDNSSECResponse {
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
        INSECURE: Array<string>;
        INVALID: Array<string>;
        OTHER: Array<string>;
        SECURE: Array<string>;
    }
}
export interface TimeseriesGroupDNSSECAwareResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupDNSSECAwareResponse.Meta;
    serie_0: TimeseriesGroupDNSSECAwareResponse.Serie0;
}
export declare namespace TimeseriesGroupDNSSECAwareResponse {
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
        NOT_SUPPORTED: Array<string>;
        SUPPORTED: Array<string>;
    }
}
export interface TimeseriesGroupDNSSECE2EResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupDNSSECE2EResponse.Meta;
    serie_0: TimeseriesGroupDNSSECE2EResponse.Serie0;
}
export declare namespace TimeseriesGroupDNSSECE2EResponse {
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
        NEGATIVE: Array<string>;
        POSITIVE: Array<string>;
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
    }
}
export interface TimeseriesGroupMatchingAnswerResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupMatchingAnswerResponse.Meta;
    serie_0: TimeseriesGroupMatchingAnswerResponse.Serie0;
}
export declare namespace TimeseriesGroupMatchingAnswerResponse {
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
        NEGATIVE: Array<string>;
        POSITIVE: Array<string>;
    }
}
export interface TimeseriesGroupProtocolResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupProtocolResponse.Meta;
    serie_0: TimeseriesGroupProtocolResponse.Serie0;
}
export declare namespace TimeseriesGroupProtocolResponse {
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
        HTTPS: Array<string>;
        TCP: Array<string>;
        TLS: Array<string>;
        UDP: Array<string>;
    }
}
export interface TimeseriesGroupQueryTypeResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupQueryTypeResponse.Meta;
    serie_0: TimeseriesGroupQueryTypeResponse.Serie0;
}
export declare namespace TimeseriesGroupQueryTypeResponse {
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
export interface TimeseriesGroupResponseCodeResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupResponseCodeResponse.Meta;
    serie_0: TimeseriesGroupResponseCodeResponse.Serie0;
}
export declare namespace TimeseriesGroupResponseCodeResponse {
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
export interface TimeseriesGroupResponseTTLResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupResponseTTLResponse.Meta;
    serie_0: TimeseriesGroupResponseTTLResponse.Serie0;
}
export declare namespace TimeseriesGroupResponseTTLResponse {
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
        gt_15m_lte_1h: Array<string>;
        gt_1d_lte_1w: Array<string>;
        gt_1h_lte_1d: Array<string>;
        gt_1m_lte_5m: Array<string>;
        gt_1w: Array<string>;
        gt_5m_lte_15m: Array<string>;
        lte_1m: Array<string>;
    }
}
export interface TimeseriesGroupCacheHitParams {
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
    /**
     * Specifies whether the response includes empty DNS responses (NODATA).
     */
    nodata?: boolean;
    /**
     * Filters results by DNS transport protocol.
     */
    protocol?: 'UDP' | 'TCP' | 'HTTPS' | 'TLS';
    /**
     * Filters results by DNS query type.
     */
    queryType?: 'A' | 'AAAA' | 'A6' | 'AFSDB' | 'ANY' | 'APL' | 'ATMA' | 'AXFR' | 'CAA' | 'CDNSKEY' | 'CDS' | 'CERT' | 'CNAME' | 'CSYNC' | 'DHCID' | 'DLV' | 'DNAME' | 'DNSKEY' | 'DOA' | 'DS' | 'EID' | 'EUI48' | 'EUI64' | 'GPOS' | 'GID' | 'HINFO' | 'HIP' | 'HTTPS' | 'IPSECKEY' | 'ISDN' | 'IXFR' | 'KEY' | 'KX' | 'L32' | 'L64' | 'LOC' | 'LP' | 'MAILA' | 'MAILB' | 'MB' | 'MD' | 'MF' | 'MG' | 'MINFO' | 'MR' | 'MX' | 'NAPTR' | 'NB' | 'NBSTAT' | 'NID' | 'NIMLOC' | 'NINFO' | 'NS' | 'NSAP' | 'NSEC' | 'NSEC3' | 'NSEC3PARAM' | 'NULL' | 'NXT' | 'OPENPGPKEY' | 'OPT' | 'PTR' | 'PX' | 'RKEY' | 'RP' | 'RRSIG' | 'RT' | 'SIG' | 'SINK' | 'SMIMEA' | 'SOA' | 'SPF' | 'SRV' | 'SSHFP' | 'SVCB' | 'TA' | 'TALINK' | 'TKEY' | 'TLSA' | 'TSIG' | 'TXT' | 'UINFO' | 'UID' | 'UNSPEC' | 'URI' | 'WKS' | 'X25' | 'ZONEMD' | null;
    /**
     * Filters results by DNS response code.
     */
    responseCode?: 'NOERROR' | 'FORMERR' | 'SERVFAIL' | 'NXDOMAIN' | 'NOTIMP' | 'REFUSED' | 'YXDOMAIN' | 'YXRRSET' | 'NXRRSET' | 'NOTAUTH' | 'NOTZONE' | 'BADSIG' | 'BADKEY' | 'BADTIME' | 'BADMODE' | 'BADNAME' | 'BADALG' | 'BADTRUNC' | 'BADCOOKIE';
    /**
     * Filters results by country code top-level domain (ccTLD).
     */
    tld?: Array<string>;
}
export interface TimeseriesGroupDNSSECParams {
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
    /**
     * Specifies whether the response includes empty DNS responses (NODATA).
     */
    nodata?: boolean;
    /**
     * Filters results by DNS transport protocol.
     */
    protocol?: 'UDP' | 'TCP' | 'HTTPS' | 'TLS';
    /**
     * Filters results by DNS query type.
     */
    queryType?: 'A' | 'AAAA' | 'A6' | 'AFSDB' | 'ANY' | 'APL' | 'ATMA' | 'AXFR' | 'CAA' | 'CDNSKEY' | 'CDS' | 'CERT' | 'CNAME' | 'CSYNC' | 'DHCID' | 'DLV' | 'DNAME' | 'DNSKEY' | 'DOA' | 'DS' | 'EID' | 'EUI48' | 'EUI64' | 'GPOS' | 'GID' | 'HINFO' | 'HIP' | 'HTTPS' | 'IPSECKEY' | 'ISDN' | 'IXFR' | 'KEY' | 'KX' | 'L32' | 'L64' | 'LOC' | 'LP' | 'MAILA' | 'MAILB' | 'MB' | 'MD' | 'MF' | 'MG' | 'MINFO' | 'MR' | 'MX' | 'NAPTR' | 'NB' | 'NBSTAT' | 'NID' | 'NIMLOC' | 'NINFO' | 'NS' | 'NSAP' | 'NSEC' | 'NSEC3' | 'NSEC3PARAM' | 'NULL' | 'NXT' | 'OPENPGPKEY' | 'OPT' | 'PTR' | 'PX' | 'RKEY' | 'RP' | 'RRSIG' | 'RT' | 'SIG' | 'SINK' | 'SMIMEA' | 'SOA' | 'SPF' | 'SRV' | 'SSHFP' | 'SVCB' | 'TA' | 'TALINK' | 'TKEY' | 'TLSA' | 'TSIG' | 'TXT' | 'UINFO' | 'UID' | 'UNSPEC' | 'URI' | 'WKS' | 'X25' | 'ZONEMD' | null;
    /**
     * Filters results by DNS response code.
     */
    responseCode?: 'NOERROR' | 'FORMERR' | 'SERVFAIL' | 'NXDOMAIN' | 'NOTIMP' | 'REFUSED' | 'YXDOMAIN' | 'YXRRSET' | 'NXRRSET' | 'NOTAUTH' | 'NOTZONE' | 'BADSIG' | 'BADKEY' | 'BADTIME' | 'BADMODE' | 'BADNAME' | 'BADALG' | 'BADTRUNC' | 'BADCOOKIE';
    /**
     * Filters results by country code top-level domain (ccTLD).
     */
    tld?: Array<string>;
}
export interface TimeseriesGroupDNSSECAwareParams {
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
    /**
     * Specifies whether the response includes empty DNS responses (NODATA).
     */
    nodata?: boolean;
    /**
     * Filters results by DNS transport protocol.
     */
    protocol?: 'UDP' | 'TCP' | 'HTTPS' | 'TLS';
    /**
     * Filters results by DNS query type.
     */
    queryType?: 'A' | 'AAAA' | 'A6' | 'AFSDB' | 'ANY' | 'APL' | 'ATMA' | 'AXFR' | 'CAA' | 'CDNSKEY' | 'CDS' | 'CERT' | 'CNAME' | 'CSYNC' | 'DHCID' | 'DLV' | 'DNAME' | 'DNSKEY' | 'DOA' | 'DS' | 'EID' | 'EUI48' | 'EUI64' | 'GPOS' | 'GID' | 'HINFO' | 'HIP' | 'HTTPS' | 'IPSECKEY' | 'ISDN' | 'IXFR' | 'KEY' | 'KX' | 'L32' | 'L64' | 'LOC' | 'LP' | 'MAILA' | 'MAILB' | 'MB' | 'MD' | 'MF' | 'MG' | 'MINFO' | 'MR' | 'MX' | 'NAPTR' | 'NB' | 'NBSTAT' | 'NID' | 'NIMLOC' | 'NINFO' | 'NS' | 'NSAP' | 'NSEC' | 'NSEC3' | 'NSEC3PARAM' | 'NULL' | 'NXT' | 'OPENPGPKEY' | 'OPT' | 'PTR' | 'PX' | 'RKEY' | 'RP' | 'RRSIG' | 'RT' | 'SIG' | 'SINK' | 'SMIMEA' | 'SOA' | 'SPF' | 'SRV' | 'SSHFP' | 'SVCB' | 'TA' | 'TALINK' | 'TKEY' | 'TLSA' | 'TSIG' | 'TXT' | 'UINFO' | 'UID' | 'UNSPEC' | 'URI' | 'WKS' | 'X25' | 'ZONEMD' | null;
    /**
     * Filters results by DNS response code.
     */
    responseCode?: 'NOERROR' | 'FORMERR' | 'SERVFAIL' | 'NXDOMAIN' | 'NOTIMP' | 'REFUSED' | 'YXDOMAIN' | 'YXRRSET' | 'NXRRSET' | 'NOTAUTH' | 'NOTZONE' | 'BADSIG' | 'BADKEY' | 'BADTIME' | 'BADMODE' | 'BADNAME' | 'BADALG' | 'BADTRUNC' | 'BADCOOKIE';
    /**
     * Filters results by country code top-level domain (ccTLD).
     */
    tld?: Array<string>;
}
export interface TimeseriesGroupDNSSECE2EParams {
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
    /**
     * Specifies whether the response includes empty DNS responses (NODATA).
     */
    nodata?: boolean;
    /**
     * Filters results by DNS transport protocol.
     */
    protocol?: 'UDP' | 'TCP' | 'HTTPS' | 'TLS';
    /**
     * Filters results by DNS query type.
     */
    queryType?: 'A' | 'AAAA' | 'A6' | 'AFSDB' | 'ANY' | 'APL' | 'ATMA' | 'AXFR' | 'CAA' | 'CDNSKEY' | 'CDS' | 'CERT' | 'CNAME' | 'CSYNC' | 'DHCID' | 'DLV' | 'DNAME' | 'DNSKEY' | 'DOA' | 'DS' | 'EID' | 'EUI48' | 'EUI64' | 'GPOS' | 'GID' | 'HINFO' | 'HIP' | 'HTTPS' | 'IPSECKEY' | 'ISDN' | 'IXFR' | 'KEY' | 'KX' | 'L32' | 'L64' | 'LOC' | 'LP' | 'MAILA' | 'MAILB' | 'MB' | 'MD' | 'MF' | 'MG' | 'MINFO' | 'MR' | 'MX' | 'NAPTR' | 'NB' | 'NBSTAT' | 'NID' | 'NIMLOC' | 'NINFO' | 'NS' | 'NSAP' | 'NSEC' | 'NSEC3' | 'NSEC3PARAM' | 'NULL' | 'NXT' | 'OPENPGPKEY' | 'OPT' | 'PTR' | 'PX' | 'RKEY' | 'RP' | 'RRSIG' | 'RT' | 'SIG' | 'SINK' | 'SMIMEA' | 'SOA' | 'SPF' | 'SRV' | 'SSHFP' | 'SVCB' | 'TA' | 'TALINK' | 'TKEY' | 'TLSA' | 'TSIG' | 'TXT' | 'UINFO' | 'UID' | 'UNSPEC' | 'URI' | 'WKS' | 'X25' | 'ZONEMD' | null;
    /**
     * Filters results by DNS response code.
     */
    responseCode?: 'NOERROR' | 'FORMERR' | 'SERVFAIL' | 'NXDOMAIN' | 'NOTIMP' | 'REFUSED' | 'YXDOMAIN' | 'YXRRSET' | 'NXRRSET' | 'NOTAUTH' | 'NOTZONE' | 'BADSIG' | 'BADKEY' | 'BADTIME' | 'BADMODE' | 'BADNAME' | 'BADALG' | 'BADTRUNC' | 'BADCOOKIE';
    /**
     * Filters results by country code top-level domain (ccTLD).
     */
    tld?: Array<string>;
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
     * Specifies whether the response includes empty DNS responses (NODATA).
     */
    nodata?: boolean;
    /**
     * Filters results by DNS transport protocol.
     */
    protocol?: 'UDP' | 'TCP' | 'HTTPS' | 'TLS';
    /**
     * Filters results by DNS query type.
     */
    queryType?: 'A' | 'AAAA' | 'A6' | 'AFSDB' | 'ANY' | 'APL' | 'ATMA' | 'AXFR' | 'CAA' | 'CDNSKEY' | 'CDS' | 'CERT' | 'CNAME' | 'CSYNC' | 'DHCID' | 'DLV' | 'DNAME' | 'DNSKEY' | 'DOA' | 'DS' | 'EID' | 'EUI48' | 'EUI64' | 'GPOS' | 'GID' | 'HINFO' | 'HIP' | 'HTTPS' | 'IPSECKEY' | 'ISDN' | 'IXFR' | 'KEY' | 'KX' | 'L32' | 'L64' | 'LOC' | 'LP' | 'MAILA' | 'MAILB' | 'MB' | 'MD' | 'MF' | 'MG' | 'MINFO' | 'MR' | 'MX' | 'NAPTR' | 'NB' | 'NBSTAT' | 'NID' | 'NIMLOC' | 'NINFO' | 'NS' | 'NSAP' | 'NSEC' | 'NSEC3' | 'NSEC3PARAM' | 'NULL' | 'NXT' | 'OPENPGPKEY' | 'OPT' | 'PTR' | 'PX' | 'RKEY' | 'RP' | 'RRSIG' | 'RT' | 'SIG' | 'SINK' | 'SMIMEA' | 'SOA' | 'SPF' | 'SRV' | 'SSHFP' | 'SVCB' | 'TA' | 'TALINK' | 'TKEY' | 'TLSA' | 'TSIG' | 'TXT' | 'UINFO' | 'UID' | 'UNSPEC' | 'URI' | 'WKS' | 'X25' | 'ZONEMD' | null;
    /**
     * Filters results by DNS response code.
     */
    responseCode?: 'NOERROR' | 'FORMERR' | 'SERVFAIL' | 'NXDOMAIN' | 'NOTIMP' | 'REFUSED' | 'YXDOMAIN' | 'YXRRSET' | 'NXRRSET' | 'NOTAUTH' | 'NOTZONE' | 'BADSIG' | 'BADKEY' | 'BADTIME' | 'BADMODE' | 'BADNAME' | 'BADALG' | 'BADTRUNC' | 'BADCOOKIE';
    /**
     * Filters results by country code top-level domain (ccTLD).
     */
    tld?: Array<string>;
}
export interface TimeseriesGroupMatchingAnswerParams {
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
    /**
     * Specifies whether the response includes empty DNS responses (NODATA).
     */
    nodata?: boolean;
    /**
     * Filters results by DNS transport protocol.
     */
    protocol?: 'UDP' | 'TCP' | 'HTTPS' | 'TLS';
    /**
     * Filters results by DNS query type.
     */
    queryType?: 'A' | 'AAAA' | 'A6' | 'AFSDB' | 'ANY' | 'APL' | 'ATMA' | 'AXFR' | 'CAA' | 'CDNSKEY' | 'CDS' | 'CERT' | 'CNAME' | 'CSYNC' | 'DHCID' | 'DLV' | 'DNAME' | 'DNSKEY' | 'DOA' | 'DS' | 'EID' | 'EUI48' | 'EUI64' | 'GPOS' | 'GID' | 'HINFO' | 'HIP' | 'HTTPS' | 'IPSECKEY' | 'ISDN' | 'IXFR' | 'KEY' | 'KX' | 'L32' | 'L64' | 'LOC' | 'LP' | 'MAILA' | 'MAILB' | 'MB' | 'MD' | 'MF' | 'MG' | 'MINFO' | 'MR' | 'MX' | 'NAPTR' | 'NB' | 'NBSTAT' | 'NID' | 'NIMLOC' | 'NINFO' | 'NS' | 'NSAP' | 'NSEC' | 'NSEC3' | 'NSEC3PARAM' | 'NULL' | 'NXT' | 'OPENPGPKEY' | 'OPT' | 'PTR' | 'PX' | 'RKEY' | 'RP' | 'RRSIG' | 'RT' | 'SIG' | 'SINK' | 'SMIMEA' | 'SOA' | 'SPF' | 'SRV' | 'SSHFP' | 'SVCB' | 'TA' | 'TALINK' | 'TKEY' | 'TLSA' | 'TSIG' | 'TXT' | 'UINFO' | 'UID' | 'UNSPEC' | 'URI' | 'WKS' | 'X25' | 'ZONEMD' | null;
    /**
     * Filters results by DNS response code.
     */
    responseCode?: 'NOERROR' | 'FORMERR' | 'SERVFAIL' | 'NXDOMAIN' | 'NOTIMP' | 'REFUSED' | 'YXDOMAIN' | 'YXRRSET' | 'NXRRSET' | 'NOTAUTH' | 'NOTZONE' | 'BADSIG' | 'BADKEY' | 'BADTIME' | 'BADMODE' | 'BADNAME' | 'BADALG' | 'BADTRUNC' | 'BADCOOKIE';
    /**
     * Filters results by country code top-level domain (ccTLD).
     */
    tld?: Array<string>;
}
export interface TimeseriesGroupProtocolParams {
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
    /**
     * Specifies whether the response includes empty DNS responses (NODATA).
     */
    nodata?: boolean;
    /**
     * Filters results by DNS query type.
     */
    queryType?: 'A' | 'AAAA' | 'A6' | 'AFSDB' | 'ANY' | 'APL' | 'ATMA' | 'AXFR' | 'CAA' | 'CDNSKEY' | 'CDS' | 'CERT' | 'CNAME' | 'CSYNC' | 'DHCID' | 'DLV' | 'DNAME' | 'DNSKEY' | 'DOA' | 'DS' | 'EID' | 'EUI48' | 'EUI64' | 'GPOS' | 'GID' | 'HINFO' | 'HIP' | 'HTTPS' | 'IPSECKEY' | 'ISDN' | 'IXFR' | 'KEY' | 'KX' | 'L32' | 'L64' | 'LOC' | 'LP' | 'MAILA' | 'MAILB' | 'MB' | 'MD' | 'MF' | 'MG' | 'MINFO' | 'MR' | 'MX' | 'NAPTR' | 'NB' | 'NBSTAT' | 'NID' | 'NIMLOC' | 'NINFO' | 'NS' | 'NSAP' | 'NSEC' | 'NSEC3' | 'NSEC3PARAM' | 'NULL' | 'NXT' | 'OPENPGPKEY' | 'OPT' | 'PTR' | 'PX' | 'RKEY' | 'RP' | 'RRSIG' | 'RT' | 'SIG' | 'SINK' | 'SMIMEA' | 'SOA' | 'SPF' | 'SRV' | 'SSHFP' | 'SVCB' | 'TA' | 'TALINK' | 'TKEY' | 'TLSA' | 'TSIG' | 'TXT' | 'UINFO' | 'UID' | 'UNSPEC' | 'URI' | 'WKS' | 'X25' | 'ZONEMD' | null;
    /**
     * Filters results by DNS response code.
     */
    responseCode?: 'NOERROR' | 'FORMERR' | 'SERVFAIL' | 'NXDOMAIN' | 'NOTIMP' | 'REFUSED' | 'YXDOMAIN' | 'YXRRSET' | 'NXRRSET' | 'NOTAUTH' | 'NOTZONE' | 'BADSIG' | 'BADKEY' | 'BADTIME' | 'BADMODE' | 'BADNAME' | 'BADALG' | 'BADTRUNC' | 'BADCOOKIE';
    /**
     * Filters results by country code top-level domain (ccTLD).
     */
    tld?: Array<string>;
}
export interface TimeseriesGroupQueryTypeParams {
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
     * Specifies whether the response includes empty DNS responses (NODATA).
     */
    nodata?: boolean;
    /**
     * Filters results by DNS transport protocol.
     */
    protocol?: 'UDP' | 'TCP' | 'HTTPS' | 'TLS';
    /**
     * Filters results by DNS response code.
     */
    responseCode?: 'NOERROR' | 'FORMERR' | 'SERVFAIL' | 'NXDOMAIN' | 'NOTIMP' | 'REFUSED' | 'YXDOMAIN' | 'YXRRSET' | 'NXRRSET' | 'NOTAUTH' | 'NOTZONE' | 'BADSIG' | 'BADKEY' | 'BADTIME' | 'BADMODE' | 'BADNAME' | 'BADALG' | 'BADTRUNC' | 'BADCOOKIE';
    /**
     * Filters results by country code top-level domain (ccTLD).
     */
    tld?: Array<string>;
}
export interface TimeseriesGroupResponseCodeParams {
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
     * Specifies whether the response includes empty DNS responses (NODATA).
     */
    nodata?: boolean;
    /**
     * Filters results by DNS transport protocol.
     */
    protocol?: 'UDP' | 'TCP' | 'HTTPS' | 'TLS';
    /**
     * Filters results by DNS query type.
     */
    queryType?: 'A' | 'AAAA' | 'A6' | 'AFSDB' | 'ANY' | 'APL' | 'ATMA' | 'AXFR' | 'CAA' | 'CDNSKEY' | 'CDS' | 'CERT' | 'CNAME' | 'CSYNC' | 'DHCID' | 'DLV' | 'DNAME' | 'DNSKEY' | 'DOA' | 'DS' | 'EID' | 'EUI48' | 'EUI64' | 'GPOS' | 'GID' | 'HINFO' | 'HIP' | 'HTTPS' | 'IPSECKEY' | 'ISDN' | 'IXFR' | 'KEY' | 'KX' | 'L32' | 'L64' | 'LOC' | 'LP' | 'MAILA' | 'MAILB' | 'MB' | 'MD' | 'MF' | 'MG' | 'MINFO' | 'MR' | 'MX' | 'NAPTR' | 'NB' | 'NBSTAT' | 'NID' | 'NIMLOC' | 'NINFO' | 'NS' | 'NSAP' | 'NSEC' | 'NSEC3' | 'NSEC3PARAM' | 'NULL' | 'NXT' | 'OPENPGPKEY' | 'OPT' | 'PTR' | 'PX' | 'RKEY' | 'RP' | 'RRSIG' | 'RT' | 'SIG' | 'SINK' | 'SMIMEA' | 'SOA' | 'SPF' | 'SRV' | 'SSHFP' | 'SVCB' | 'TA' | 'TALINK' | 'TKEY' | 'TLSA' | 'TSIG' | 'TXT' | 'UINFO' | 'UID' | 'UNSPEC' | 'URI' | 'WKS' | 'X25' | 'ZONEMD' | null;
    /**
     * Filters results by country code top-level domain (ccTLD).
     */
    tld?: Array<string>;
}
export interface TimeseriesGroupResponseTTLParams {
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
    /**
     * Specifies whether the response includes empty DNS responses (NODATA).
     */
    nodata?: boolean;
    /**
     * Filters results by DNS transport protocol.
     */
    protocol?: 'UDP' | 'TCP' | 'HTTPS' | 'TLS';
    /**
     * Filters results by DNS query type.
     */
    queryType?: 'A' | 'AAAA' | 'A6' | 'AFSDB' | 'ANY' | 'APL' | 'ATMA' | 'AXFR' | 'CAA' | 'CDNSKEY' | 'CDS' | 'CERT' | 'CNAME' | 'CSYNC' | 'DHCID' | 'DLV' | 'DNAME' | 'DNSKEY' | 'DOA' | 'DS' | 'EID' | 'EUI48' | 'EUI64' | 'GPOS' | 'GID' | 'HINFO' | 'HIP' | 'HTTPS' | 'IPSECKEY' | 'ISDN' | 'IXFR' | 'KEY' | 'KX' | 'L32' | 'L64' | 'LOC' | 'LP' | 'MAILA' | 'MAILB' | 'MB' | 'MD' | 'MF' | 'MG' | 'MINFO' | 'MR' | 'MX' | 'NAPTR' | 'NB' | 'NBSTAT' | 'NID' | 'NIMLOC' | 'NINFO' | 'NS' | 'NSAP' | 'NSEC' | 'NSEC3' | 'NSEC3PARAM' | 'NULL' | 'NXT' | 'OPENPGPKEY' | 'OPT' | 'PTR' | 'PX' | 'RKEY' | 'RP' | 'RRSIG' | 'RT' | 'SIG' | 'SINK' | 'SMIMEA' | 'SOA' | 'SPF' | 'SRV' | 'SSHFP' | 'SVCB' | 'TA' | 'TALINK' | 'TKEY' | 'TLSA' | 'TSIG' | 'TXT' | 'UINFO' | 'UID' | 'UNSPEC' | 'URI' | 'WKS' | 'X25' | 'ZONEMD' | null;
    /**
     * Filters results by DNS response code.
     */
    responseCode?: 'NOERROR' | 'FORMERR' | 'SERVFAIL' | 'NXDOMAIN' | 'NOTIMP' | 'REFUSED' | 'YXDOMAIN' | 'YXRRSET' | 'NXRRSET' | 'NOTAUTH' | 'NOTZONE' | 'BADSIG' | 'BADKEY' | 'BADTIME' | 'BADMODE' | 'BADNAME' | 'BADALG' | 'BADTRUNC' | 'BADCOOKIE';
    /**
     * Filters results by country code top-level domain (ccTLD).
     */
    tld?: Array<string>;
}
export declare namespace TimeseriesGroups {
    export { type TimeseriesGroupCacheHitResponse as TimeseriesGroupCacheHitResponse, type TimeseriesGroupDNSSECResponse as TimeseriesGroupDNSSECResponse, type TimeseriesGroupDNSSECAwareResponse as TimeseriesGroupDNSSECAwareResponse, type TimeseriesGroupDNSSECE2EResponse as TimeseriesGroupDNSSECE2EResponse, type TimeseriesGroupIPVersionResponse as TimeseriesGroupIPVersionResponse, type TimeseriesGroupMatchingAnswerResponse as TimeseriesGroupMatchingAnswerResponse, type TimeseriesGroupProtocolResponse as TimeseriesGroupProtocolResponse, type TimeseriesGroupQueryTypeResponse as TimeseriesGroupQueryTypeResponse, type TimeseriesGroupResponseCodeResponse as TimeseriesGroupResponseCodeResponse, type TimeseriesGroupResponseTTLResponse as TimeseriesGroupResponseTTLResponse, type TimeseriesGroupCacheHitParams as TimeseriesGroupCacheHitParams, type TimeseriesGroupDNSSECParams as TimeseriesGroupDNSSECParams, type TimeseriesGroupDNSSECAwareParams as TimeseriesGroupDNSSECAwareParams, type TimeseriesGroupDNSSECE2EParams as TimeseriesGroupDNSSECE2EParams, type TimeseriesGroupIPVersionParams as TimeseriesGroupIPVersionParams, type TimeseriesGroupMatchingAnswerParams as TimeseriesGroupMatchingAnswerParams, type TimeseriesGroupProtocolParams as TimeseriesGroupProtocolParams, type TimeseriesGroupQueryTypeParams as TimeseriesGroupQueryTypeParams, type TimeseriesGroupResponseCodeParams as TimeseriesGroupResponseCodeParams, type TimeseriesGroupResponseTTLParams as TimeseriesGroupResponseTTLParams, };
}
//# sourceMappingURL=timeseries-groups.d.ts.map