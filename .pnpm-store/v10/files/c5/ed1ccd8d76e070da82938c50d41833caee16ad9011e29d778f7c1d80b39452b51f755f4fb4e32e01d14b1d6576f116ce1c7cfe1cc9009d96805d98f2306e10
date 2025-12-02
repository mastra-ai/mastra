import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as EmailAPI from "../email.js";
export declare class Summary extends APIResource {
    /**
     * Retrieves the distribution of emails by ARC (Authenticated Received Chain)
     * validation.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.summary.arc();
     * ```
     */
    arc(query?: SummaryARCParams, options?: Core.RequestOptions): Core.APIPromise<SummaryARCResponse>;
    arc(options?: Core.RequestOptions): Core.APIPromise<SummaryARCResponse>;
    /**
     * Retrieves the distribution of emails by DKIM (DomainKeys Identified Mail)
     * validation.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.summary.dkim();
     * ```
     */
    dkim(query?: SummaryDKIMParams, options?: Core.RequestOptions): Core.APIPromise<SummaryDKIMResponse>;
    dkim(options?: Core.RequestOptions): Core.APIPromise<SummaryDKIMResponse>;
    /**
     * Retrieves the distribution of emails by DMARC (Domain-based Message
     * Authentication, Reporting and Conformance) validation.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.summary.dmarc();
     * ```
     */
    dmarc(query?: SummaryDMARCParams, options?: Core.RequestOptions): Core.APIPromise<SummaryDMARCResponse>;
    dmarc(options?: Core.RequestOptions): Core.APIPromise<SummaryDMARCResponse>;
    /**
     * Retrieves the distribution of emails by malicious classification.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.summary.malicious();
     * ```
     */
    malicious(query?: SummaryMaliciousParams, options?: Core.RequestOptions): Core.APIPromise<SummaryMaliciousResponse>;
    malicious(options?: Core.RequestOptions): Core.APIPromise<SummaryMaliciousResponse>;
    /**
     * Retrieves the proportion of emails by spam classification (spam vs. non-spam).
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.summary.spam();
     * ```
     */
    spam(query?: SummarySpamParams, options?: Core.RequestOptions): Core.APIPromise<SummarySpamResponse>;
    spam(options?: Core.RequestOptions): Core.APIPromise<SummarySpamResponse>;
    /**
     * Retrieves the distribution of emails by SPF (Sender Policy Framework)
     * validation.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.summary.spf();
     * ```
     */
    spf(query?: SummarySPFParams, options?: Core.RequestOptions): Core.APIPromise<SummarySPFResponse>;
    spf(options?: Core.RequestOptions): Core.APIPromise<SummarySPFResponse>;
    /**
     * Retrieves the proportion of emails by spoof classification (spoof vs.
     * non-spoof).
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.summary.spoof();
     * ```
     */
    spoof(query?: SummarySpoofParams, options?: Core.RequestOptions): Core.APIPromise<SummarySpoofResponse>;
    spoof(options?: Core.RequestOptions): Core.APIPromise<SummarySpoofResponse>;
    /**
     * Retrieves the distribution of emails by threat categories.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.summary.threatCategory();
     * ```
     */
    threatCategory(query?: SummaryThreatCategoryParams, options?: Core.RequestOptions): Core.APIPromise<SummaryThreatCategoryResponse>;
    threatCategory(options?: Core.RequestOptions): Core.APIPromise<SummaryThreatCategoryResponse>;
    /**
     * Retrieves the distribution of emails by TLS version.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.email.security.summary.tlsVersion();
     * ```
     */
    tlsVersion(query?: SummaryTLSVersionParams, options?: Core.RequestOptions): Core.APIPromise<SummaryTLSVersionResponse>;
    tlsVersion(options?: Core.RequestOptions): Core.APIPromise<SummaryTLSVersionResponse>;
}
export interface SummaryARCResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryARCResponse.Meta;
    summary_0: EmailAPI.RadarEmailSummary;
}
export declare namespace SummaryARCResponse {
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
}
export interface SummaryDKIMResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryDKIMResponse.Meta;
    summary_0: EmailAPI.RadarEmailSummary;
}
export declare namespace SummaryDKIMResponse {
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
}
export interface SummaryDMARCResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryDMARCResponse.Meta;
    summary_0: EmailAPI.RadarEmailSummary;
}
export declare namespace SummaryDMARCResponse {
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
}
export interface SummaryMaliciousResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryMaliciousResponse.Meta;
    summary_0: SummaryMaliciousResponse.Summary0;
}
export declare namespace SummaryMaliciousResponse {
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
        MALICIOUS: string;
        /**
         * A numeric string.
         */
        NOT_MALICIOUS: string;
    }
}
export interface SummarySpamResponse {
    /**
     * Metadata for the results.
     */
    meta: SummarySpamResponse.Meta;
    summary_0: SummarySpamResponse.Summary0;
}
export declare namespace SummarySpamResponse {
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
        NOT_SPAM: string;
        /**
         * A numeric string.
         */
        SPAM: string;
    }
}
export interface SummarySPFResponse {
    /**
     * Metadata for the results.
     */
    meta: SummarySPFResponse.Meta;
    summary_0: EmailAPI.RadarEmailSummary;
}
export declare namespace SummarySPFResponse {
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
}
export interface SummarySpoofResponse {
    /**
     * Metadata for the results.
     */
    meta: SummarySpoofResponse.Meta;
    summary_0: SummarySpoofResponse.Summary0;
}
export declare namespace SummarySpoofResponse {
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
        NOT_SPOOF: string;
        /**
         * A numeric string.
         */
        SPOOF: string;
    }
}
export interface SummaryThreatCategoryResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryThreatCategoryResponse.Meta;
    summary_0: SummaryThreatCategoryResponse.Summary0;
}
export declare namespace SummaryThreatCategoryResponse {
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
        BrandImpersonation: string;
        /**
         * A numeric string.
         */
        CredentialHarvester: string;
        /**
         * A numeric string.
         */
        IdentityDeception: string;
        /**
         * A numeric string.
         */
        Link: string;
    }
}
export interface SummaryTLSVersionResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryTLSVersionResponse.Meta;
    summary_0: SummaryTLSVersionResponse.Summary0;
}
export declare namespace SummaryTLSVersionResponse {
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
        'TLS 1.0': string;
        /**
         * A numeric string.
         */
        'TLS 1.1': string;
        /**
         * A numeric string.
         */
        'TLS 1.2': string;
        /**
         * A numeric string.
         */
        'TLS 1.3': string;
    }
}
export interface SummaryARCParams {
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
export interface SummaryDKIMParams {
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
export interface SummaryDMARCParams {
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
export interface SummaryMaliciousParams {
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
export interface SummarySpamParams {
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
export interface SummarySPFParams {
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
export interface SummarySpoofParams {
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
export interface SummaryThreatCategoryParams {
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
export interface SummaryTLSVersionParams {
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
export declare namespace Summary {
    export { type SummaryARCResponse as SummaryARCResponse, type SummaryDKIMResponse as SummaryDKIMResponse, type SummaryDMARCResponse as SummaryDMARCResponse, type SummaryMaliciousResponse as SummaryMaliciousResponse, type SummarySpamResponse as SummarySpamResponse, type SummarySPFResponse as SummarySPFResponse, type SummarySpoofResponse as SummarySpoofResponse, type SummaryThreatCategoryResponse as SummaryThreatCategoryResponse, type SummaryTLSVersionResponse as SummaryTLSVersionResponse, type SummaryARCParams as SummaryARCParams, type SummaryDKIMParams as SummaryDKIMParams, type SummaryDMARCParams as SummaryDMARCParams, type SummaryMaliciousParams as SummaryMaliciousParams, type SummarySpamParams as SummarySpamParams, type SummarySPFParams as SummarySPFParams, type SummarySpoofParams as SummarySpoofParams, type SummaryThreatCategoryParams as SummaryThreatCategoryParams, type SummaryTLSVersionParams as SummaryTLSVersionParams, };
}
//# sourceMappingURL=summary.d.ts.map