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
     *   await client.radar.email.routing.timeseriesGroups.arc();
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
     *   await client.radar.email.routing.timeseriesGroups.dkim();
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
     *   await client.radar.email.routing.timeseriesGroups.dmarc();
     * ```
     */
    dmarc(query?: TimeseriesGroupDMARCParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupDMARCResponse>;
    dmarc(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupDMARCResponse>;
    /**
     * Retrieves the distribution of emails by encryption status (encrypted vs.
     * not-encrypted) over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.routing.timeseriesGroups.encrypted();
     * ```
     */
    encrypted(query?: TimeseriesGroupEncryptedParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupEncryptedResponse>;
    encrypted(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupEncryptedResponse>;
    /**
     * Retrieves the distribution of emails by IP version over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.routing.timeseriesGroups.ipVersion();
     * ```
     */
    ipVersion(query?: TimeseriesGroupIPVersionParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupIPVersionResponse>;
    ipVersion(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupIPVersionResponse>;
    /**
     * Retrieves the distribution of emails by SPF (Sender Policy Framework) validation
     * over time.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.routing.timeseriesGroups.spf();
     * ```
     */
    spf(query?: TimeseriesGroupSPFParams, options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupSPFResponse>;
    spf(options?: Core.RequestOptions): Core.APIPromise<TimeseriesGroupSPFResponse>;
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
export interface TimeseriesGroupEncryptedResponse {
    /**
     * Metadata for the results.
     */
    meta: TimeseriesGroupEncryptedResponse.Meta;
    serie_0: TimeseriesGroupEncryptedResponse.Serie0;
}
export declare namespace TimeseriesGroupEncryptedResponse {
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
        ENCRYPTED: Array<string>;
        NOT_ENCRYPTED: Array<string>;
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
     * Filters results by encryption status (encrypted vs. not-encrypted).
     */
    encrypted?: Array<'ENCRYPTED' | 'NOT_ENCRYPTED'>;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Filters results by IP version (Ipv4 vs. IPv6).
     */
    ipVersion?: Array<'IPv4' | 'IPv6'>;
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters results by SPF (Sender Policy Framework) validation status.
     */
    spf?: Array<'PASS' | 'NONE' | 'FAIL'>;
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
     * Filters results by encryption status (encrypted vs. not-encrypted).
     */
    encrypted?: Array<'ENCRYPTED' | 'NOT_ENCRYPTED'>;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Filters results by IP version (Ipv4 vs. IPv6).
     */
    ipVersion?: Array<'IPv4' | 'IPv6'>;
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters results by SPF (Sender Policy Framework) validation status.
     */
    spf?: Array<'PASS' | 'NONE' | 'FAIL'>;
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
     * Filters results by encryption status (encrypted vs. not-encrypted).
     */
    encrypted?: Array<'ENCRYPTED' | 'NOT_ENCRYPTED'>;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Filters results by IP version (Ipv4 vs. IPv6).
     */
    ipVersion?: Array<'IPv4' | 'IPv6'>;
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters results by SPF (Sender Policy Framework) validation status.
     */
    spf?: Array<'PASS' | 'NONE' | 'FAIL'>;
}
export interface TimeseriesGroupEncryptedParams {
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
     * Filters results by IP version (Ipv4 vs. IPv6).
     */
    ipVersion?: Array<'IPv4' | 'IPv6'>;
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters results by SPF (Sender Policy Framework) validation status.
     */
    spf?: Array<'PASS' | 'NONE' | 'FAIL'>;
}
export interface TimeseriesGroupIPVersionParams {
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
     * Filters results by encryption status (encrypted vs. not-encrypted).
     */
    encrypted?: Array<'ENCRYPTED' | 'NOT_ENCRYPTED'>;
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
     * Filters results by encryption status (encrypted vs. not-encrypted).
     */
    encrypted?: Array<'ENCRYPTED' | 'NOT_ENCRYPTED'>;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Filters results by IP version (Ipv4 vs. IPv6).
     */
    ipVersion?: Array<'IPv4' | 'IPv6'>;
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
}
export declare namespace TimeseriesGroups {
    export { type TimeseriesGroupARCResponse as TimeseriesGroupARCResponse, type TimeseriesGroupDKIMResponse as TimeseriesGroupDKIMResponse, type TimeseriesGroupDMARCResponse as TimeseriesGroupDMARCResponse, type TimeseriesGroupEncryptedResponse as TimeseriesGroupEncryptedResponse, type TimeseriesGroupIPVersionResponse as TimeseriesGroupIPVersionResponse, type TimeseriesGroupSPFResponse as TimeseriesGroupSPFResponse, type TimeseriesGroupARCParams as TimeseriesGroupARCParams, type TimeseriesGroupDKIMParams as TimeseriesGroupDKIMParams, type TimeseriesGroupDMARCParams as TimeseriesGroupDMARCParams, type TimeseriesGroupEncryptedParams as TimeseriesGroupEncryptedParams, type TimeseriesGroupIPVersionParams as TimeseriesGroupIPVersionParams, type TimeseriesGroupSPFParams as TimeseriesGroupSPFParams, };
}
//# sourceMappingURL=timeseries-groups.d.ts.map