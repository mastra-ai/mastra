import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as EmailAPI from "../email.js";
export declare class TimeseriesGroups extends APIResource {
    /**
     * Retrieves the distribution of emails by ARC (Authenticated Received Chain)
     * validation over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.timeseriesGroups.arc();
     * ```
     */
    arc(query?: TimeseriesGroupARCParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupARCResponse>;
    arc(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupARCResponse>;
    /**
     * Retrieves the distribution of emails by DKIM (DomainKeys Identified Mail)
     * validation over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.timeseriesGroups.dkim();
     * ```
     */
    dkim(query?: TimeseriesGroupDKIMParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupDKIMResponse>;
    dkim(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupDKIMResponse>;
    /**
     * Retrieves the distribution of emails by DMARC (Domain-based Message
     * Authentication, Reporting and Conformance) validation over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.timeseriesGroups.dmarc();
     * ```
     */
    dmarc(query?: TimeseriesGroupDMARCParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupDMARCResponse>;
    dmarc(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupDMARCResponse>;
    /**
     * Retrieves the distribution of emails by malicious classification over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.timeseriesGroups.malicious();
     * ```
     */
    malicious(query?: TimeseriesGroupMaliciousParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupMaliciousResponse>;
    malicious(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupMaliciousResponse>;
    /**
     * Retrieves the distribution of emails by spam classification (spam vs. non-spam)
     * over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.timeseriesGroups.spam();
     * ```
     */
    spam(query?: TimeseriesGroupSpamParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupSpamResponse>;
    spam(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupSpamResponse>;
    /**
     * Retrieves the distribution of emails by SPF (Sender Policy Framework) validation
     * over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.timeseriesGroups.spf();
     * ```
     */
    spf(query?: TimeseriesGroupSPFParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupSPFResponse>;
    spf(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupSPFResponse>;
    /**
     * Retrieves the distribution of emails by spoof classification (spoof vs.
     * non-spoof) over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.timeseriesGroups.spoof();
     * ```
     */
    spoof(query?: TimeseriesGroupSpoofParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupSpoofResponse>;
    spoof(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupSpoofResponse>;
    /**
     * Retrieves the distribution of emails by threat category over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.timeseriesGroups.threatCategory();
     * ```
     */
    threatCategory(query?: TimeseriesGroupThreatCategoryParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupThreatCategoryResponse>;
    threatCategory(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupThreatCategoryResponse>;
    /**
     * Retrieves the distribution of emails by TLS version over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.timeseriesGroups.tlsVersion();
     * ```
     */
    tlsVersion(query?: TimeseriesGroupTLSVersionParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupTLSVersionResponse>;
    tlsVersion(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupTLSVersionResponse>;
}
export interface TimeseriesGroupARCResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupARCResponse.Meta;
    serie_0: EmailAPI.RadarEmailSeries;
}
export declare namespace TimeseriesGroupARCResponse {
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
}
export interface TimeseriesGroupDKIMResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupDKIMResponse.Meta;
    serie_0: EmailAPI.RadarEmailSeries;
}
export declare namespace TimeseriesGroupDKIMResponse {
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
}
export interface TimeseriesGroupDMARCResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupDMARCResponse.Meta;
    serie_0: EmailAPI.RadarEmailSeries;
}
export declare namespace TimeseriesGroupDMARCResponse {
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
}
export interface TimeseriesGroupMaliciousResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupMaliciousResponse.Meta;
    serie_0: TimeseriesGroupMaliciousResponse.Serie0;
}
export declare namespace TimeseriesGroupMaliciousResponse {
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
        MALICIOUS: Array<string>;
        NOT_MALICIOUS: Array<string>;
    }
}
export interface TimeseriesGroupSpamResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupSpamResponse.Meta;
    serie_0: TimeseriesGroupSpamResponse.Serie0;
}
export declare namespace TimeseriesGroupSpamResponse {
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
        NOT_SPAM: Array<string>;
        SPAM: Array<string>;
    }
}
export interface TimeseriesGroupSPFResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupSPFResponse.Meta;
    serie_0: EmailAPI.RadarEmailSeries;
}
export declare namespace TimeseriesGroupSPFResponse {
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
}
export interface TimeseriesGroupSpoofResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupSpoofResponse.Meta;
    serie_0: TimeseriesGroupSpoofResponse.Serie0;
}
export declare namespace TimeseriesGroupSpoofResponse {
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
        NOT_SPOOF: Array<string>;
        SPOOF: Array<string>;
    }
}
export interface TimeseriesGroupThreatCategoryResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupThreatCategoryResponse.Meta;
    serie_0: TimeseriesGroupThreatCategoryResponse.Serie0;
}
export declare namespace TimeseriesGroupThreatCategoryResponse {
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
        BrandImpersonation: Array<string>;
        CredentialHarvester: Array<string>;
        IdentityDeception: Array<string>;
        Link: Array<string>;
    }
}
export interface TimeseriesGroupTLSVersionResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupTLSVersionResponse.Meta;
    serie_0: TimeseriesGroupTLSVersionResponse.Serie0;
}
export declare namespace TimeseriesGroupTLSVersionResponse {
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
        'TLS 1.0': Array<string>;
        'TLS 1.1': Array<string>;
        'TLS 1.2': Array<string>;
        'TLS 1.3': Array<string>;
    }
}
export interface TimeseriesGroupARCParams {
    /**
     * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
     * Refer to
     * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
     */
    aggInterval?: '15m' | '1h' | '1d' | '1w';
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
     * Filters results by DKIM (DomainKeys Identified Mail) validation status.
     */
    dkim?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Filters results by DMARC (Domain-based Message Authentication, Reporting and
     * Conformance) validation status.
     */
    dmarc?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters results by SPF (Sender Policy Framework) validation status.
     */
    spf?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Filters results by TLS version.
     */
    tlsVersion?: Array<'TLSv1_0' | 'TLSv1_1' | 'TLSv1_2' | 'TLSv1_3'>;
}
export interface TimeseriesGroupDKIMParams {
    /**
     * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
     * Refer to
     * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
     */
    aggInterval?: '15m' | '1h' | '1d' | '1w';
    /**
     * Filters results by ARC (Authenticated Received Chain) validation.
     */
    arc?: Array<'PASS' | 'NONE' | 'FAIL'>;
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
     * Filters results by DMARC (Domain-based Message Authentication, Reporting and
     * Conformance) validation status.
     */
    dmarc?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters results by SPF (Sender Policy Framework) validation status.
     */
    spf?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Filters results by TLS version.
     */
    tlsVersion?: Array<'TLSv1_0' | 'TLSv1_1' | 'TLSv1_2' | 'TLSv1_3'>;
}
export interface TimeseriesGroupDMARCParams {
    /**
     * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
     * Refer to
     * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
     */
    aggInterval?: '15m' | '1h' | '1d' | '1w';
    /**
     * Filters results by ARC (Authenticated Received Chain) validation.
     */
    arc?: Array<'PASS' | 'NONE' | 'FAIL'>;
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
     * Filters results by DKIM (DomainKeys Identified Mail) validation status.
     */
    dkim?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters results by SPF (Sender Policy Framework) validation status.
     */
    spf?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Filters results by TLS version.
     */
    tlsVersion?: Array<'TLSv1_0' | 'TLSv1_1' | 'TLSv1_2' | 'TLSv1_3'>;
}
export interface TimeseriesGroupMaliciousParams {
    /**
     * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
     * Refer to
     * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
     */
    aggInterval?: '15m' | '1h' | '1d' | '1w';
    /**
     * Filters results by ARC (Authenticated Received Chain) validation.
     */
    arc?: Array<'PASS' | 'NONE' | 'FAIL'>;
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
     * Filters results by DKIM (DomainKeys Identified Mail) validation status.
     */
    dkim?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Filters results by DMARC (Domain-based Message Authentication, Reporting and
     * Conformance) validation status.
     */
    dmarc?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters results by SPF (Sender Policy Framework) validation status.
     */
    spf?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Filters results by TLS version.
     */
    tlsVersion?: Array<'TLSv1_0' | 'TLSv1_1' | 'TLSv1_2' | 'TLSv1_3'>;
}
export interface TimeseriesGroupSpamParams {
    /**
     * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
     * Refer to
     * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
     */
    aggInterval?: '15m' | '1h' | '1d' | '1w';
    /**
     * Filters results by ARC (Authenticated Received Chain) validation.
     */
    arc?: Array<'PASS' | 'NONE' | 'FAIL'>;
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
     * Filters results by DKIM (DomainKeys Identified Mail) validation status.
     */
    dkim?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Filters results by DMARC (Domain-based Message Authentication, Reporting and
     * Conformance) validation status.
     */
    dmarc?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters results by SPF (Sender Policy Framework) validation status.
     */
    spf?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Filters results by TLS version.
     */
    tlsVersion?: Array<'TLSv1_0' | 'TLSv1_1' | 'TLSv1_2' | 'TLSv1_3'>;
}
export interface TimeseriesGroupSPFParams {
    /**
     * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
     * Refer to
     * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
     */
    aggInterval?: '15m' | '1h' | '1d' | '1w';
    /**
     * Filters results by ARC (Authenticated Received Chain) validation.
     */
    arc?: Array<'PASS' | 'NONE' | 'FAIL'>;
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
     * Filters results by DKIM (DomainKeys Identified Mail) validation status.
     */
    dkim?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Filters results by DMARC (Domain-based Message Authentication, Reporting and
     * Conformance) validation status.
     */
    dmarc?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters results by TLS version.
     */
    tlsVersion?: Array<'TLSv1_0' | 'TLSv1_1' | 'TLSv1_2' | 'TLSv1_3'>;
}
export interface TimeseriesGroupSpoofParams {
    /**
     * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
     * Refer to
     * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
     */
    aggInterval?: '15m' | '1h' | '1d' | '1w';
    /**
     * Filters results by ARC (Authenticated Received Chain) validation.
     */
    arc?: Array<'PASS' | 'NONE' | 'FAIL'>;
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
     * Filters results by DKIM (DomainKeys Identified Mail) validation status.
     */
    dkim?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Filters results by DMARC (Domain-based Message Authentication, Reporting and
     * Conformance) validation status.
     */
    dmarc?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters results by SPF (Sender Policy Framework) validation status.
     */
    spf?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Filters results by TLS version.
     */
    tlsVersion?: Array<'TLSv1_0' | 'TLSv1_1' | 'TLSv1_2' | 'TLSv1_3'>;
}
export interface TimeseriesGroupThreatCategoryParams {
    /**
     * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
     * Refer to
     * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
     */
    aggInterval?: '15m' | '1h' | '1d' | '1w';
    /**
     * Filters results by ARC (Authenticated Received Chain) validation.
     */
    arc?: Array<'PASS' | 'NONE' | 'FAIL'>;
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
     * Filters results by DKIM (DomainKeys Identified Mail) validation status.
     */
    dkim?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Filters results by DMARC (Domain-based Message Authentication, Reporting and
     * Conformance) validation status.
     */
    dmarc?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters results by SPF (Sender Policy Framework) validation status.
     */
    spf?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Filters results by TLS version.
     */
    tlsVersion?: Array<'TLSv1_0' | 'TLSv1_1' | 'TLSv1_2' | 'TLSv1_3'>;
}
export interface TimeseriesGroupTLSVersionParams {
    /**
     * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
     * Refer to
     * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
     */
    aggInterval?: '15m' | '1h' | '1d' | '1w';
    /**
     * Filters results by ARC (Authenticated Received Chain) validation.
     */
    arc?: Array<'PASS' | 'NONE' | 'FAIL'>;
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
     * Filters results by DKIM (DomainKeys Identified Mail) validation status.
     */
    dkim?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Filters results by DMARC (Domain-based Message Authentication, Reporting and
     * Conformance) validation status.
     */
    dmarc?: Array<'PASS' | 'NONE' | 'FAIL'>;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters results by SPF (Sender Policy Framework) validation status.
     */
    spf?: Array<'PASS' | 'NONE' | 'FAIL'>;
}
export declare namespace TimeseriesGroups {
    export { type TimeseriesGroupARCResponse as TimeseriesGroupARCResponse, type TimeseriesGroupDKIMResponse as TimeseriesGroupDKIMResponse, type TimeseriesGroupDMARCResponse as TimeseriesGroupDMARCResponse, type TimeseriesGroupMaliciousResponse as TimeseriesGroupMaliciousResponse, type TimeseriesGroupSpamResponse as TimeseriesGroupSpamResponse, type TimeseriesGroupSPFResponse as TimeseriesGroupSPFResponse, type TimeseriesGroupSpoofResponse as TimeseriesGroupSpoofResponse, type TimeseriesGroupThreatCategoryResponse as TimeseriesGroupThreatCategoryResponse, type TimeseriesGroupTLSVersionResponse as TimeseriesGroupTLSVersionResponse, type TimeseriesGroupARCParams as TimeseriesGroupARCParams, type TimeseriesGroupDKIMParams as TimeseriesGroupDKIMParams, type TimeseriesGroupDMARCParams as TimeseriesGroupDMARCParams, type TimeseriesGroupMaliciousParams as TimeseriesGroupMaliciousParams, type TimeseriesGroupSpamParams as TimeseriesGroupSpamParams, type TimeseriesGroupSPFParams as TimeseriesGroupSPFParams, type TimeseriesGroupSpoofParams as TimeseriesGroupSpoofParams, type TimeseriesGroupThreatCategoryParams as TimeseriesGroupThreatCategoryParams, type TimeseriesGroupTLSVersionParams as TimeseriesGroupTLSVersionParams, };
}
//# sourceMappingURL=timeseries-groups.d.ts.map