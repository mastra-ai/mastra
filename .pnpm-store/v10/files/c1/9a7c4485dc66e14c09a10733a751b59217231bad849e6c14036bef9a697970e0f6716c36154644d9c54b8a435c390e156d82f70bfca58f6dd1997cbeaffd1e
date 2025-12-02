import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class Summary extends APIResource {
    /**
     * Retrieves the distribution of layer 7 attacks by HTTP method.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer7.summary.httpMethod();
     * ```
     */
    httpMethod(query?: SummaryHTTPMethodParams, options?: Core.RequestOptions): Core.APIPromise<SummaryHTTPMethodResponse>;
    httpMethod(options?: Core.RequestOptions): Core.APIPromise<SummaryHTTPMethodResponse>;
    /**
     * Retrieves the distribution of layer 7 attacks by HTTP version.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer7.summary.httpVersion();
     * ```
     */
    httpVersion(query?: SummaryHTTPVersionParams, options?: Core.RequestOptions): Core.APIPromise<SummaryHTTPVersionResponse>;
    httpVersion(options?: Core.RequestOptions): Core.APIPromise<SummaryHTTPVersionResponse>;
    /**
     * Retrieves the distribution of layer 7 attacks by targeted industry.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer7.summary.industry();
     * ```
     */
    industry(query?: SummaryIndustryParams, options?: Core.RequestOptions): Core.APIPromise<SummaryIndustryResponse>;
    industry(options?: Core.RequestOptions): Core.APIPromise<SummaryIndustryResponse>;
    /**
     * Retrieves the distribution of layer 7 attacks by IP version.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer7.summary.ipVersion();
     * ```
     */
    ipVersion(query?: SummaryIPVersionParams, options?: Core.RequestOptions): Core.APIPromise<SummaryIPVersionResponse>;
    ipVersion(options?: Core.RequestOptions): Core.APIPromise<SummaryIPVersionResponse>;
    /**
     * Retrieves the distribution of layer 7 attacks by managed rules.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer7.summary.managedRules();
     * ```
     */
    managedRules(query?: SummaryManagedRulesParams, options?: Core.RequestOptions): Core.APIPromise<SummaryManagedRulesResponse>;
    managedRules(options?: Core.RequestOptions): Core.APIPromise<SummaryManagedRulesResponse>;
    /**
     * Retrieves the distribution of layer 7 attacks by mitigation product.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer7.summary.mitigationProduct();
     * ```
     */
    mitigationProduct(query?: SummaryMitigationProductParams, options?: Core.RequestOptions): Core.APIPromise<SummaryMitigationProductResponse>;
    mitigationProduct(options?: Core.RequestOptions): Core.APIPromise<SummaryMitigationProductResponse>;
    /**
     * Retrieves the distribution of layer 7 attacks by targeted vertical.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer7.summary.vertical();
     * ```
     */
    vertical(query?: SummaryVerticalParams, options?: Core.RequestOptions): Core.APIPromise<SummaryVerticalResponse>;
    vertical(options?: Core.RequestOptions): Core.APIPromise<SummaryVerticalResponse>;
}
export interface SummaryHTTPMethodResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryHTTPMethodResponse.Meta;
    summary_0: {
        [key: string]: string;
    };
}
export declare namespace SummaryHTTPMethodResponse {
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
export interface SummaryHTTPVersionResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryHTTPVersionResponse.Meta;
    summary_0: SummaryHTTPVersionResponse.Summary0;
}
export declare namespace SummaryHTTPVersionResponse {
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
        'HTTP/1.x': string;
        'HTTP/2': string;
        'HTTP/3': string;
    }
}
export interface SummaryIndustryResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryIndustryResponse.Meta;
    summary_0: {
        [key: string]: string;
    };
}
export declare namespace SummaryIndustryResponse {
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
export interface SummaryIPVersionResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryIPVersionResponse.Meta;
    summary_0: SummaryIPVersionResponse.Summary0;
}
export declare namespace SummaryIPVersionResponse {
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
        IPv4: string;
        IPv6: string;
    }
}
export interface SummaryManagedRulesResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryManagedRulesResponse.Meta;
    summary_0: {
        [key: string]: string;
    };
}
export declare namespace SummaryManagedRulesResponse {
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
export interface SummaryMitigationProductResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryMitigationProductResponse.Meta;
    summary_0: {
        [key: string]: string;
    };
}
export declare namespace SummaryMitigationProductResponse {
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
export interface SummaryVerticalResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryVerticalResponse.Meta;
    summary_0: {
        [key: string]: string;
    };
}
export declare namespace SummaryVerticalResponse {
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
export interface SummaryHTTPMethodParams {
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
}
export interface SummaryHTTPVersionParams {
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
}
export interface SummaryIndustryParams {
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
}
export interface SummaryIPVersionParams {
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
}
export interface SummaryManagedRulesParams {
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
}
export interface SummaryMitigationProductParams {
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
}
export interface SummaryVerticalParams {
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
}
export declare namespace Summary {
    export { type SummaryHTTPMethodResponse as SummaryHTTPMethodResponse, type SummaryHTTPVersionResponse as SummaryHTTPVersionResponse, type SummaryIndustryResponse as SummaryIndustryResponse, type SummaryIPVersionResponse as SummaryIPVersionResponse, type SummaryManagedRulesResponse as SummaryManagedRulesResponse, type SummaryMitigationProductResponse as SummaryMitigationProductResponse, type SummaryVerticalResponse as SummaryVerticalResponse, type SummaryHTTPMethodParams as SummaryHTTPMethodParams, type SummaryHTTPVersionParams as SummaryHTTPVersionParams, type SummaryIndustryParams as SummaryIndustryParams, type SummaryIPVersionParams as SummaryIPVersionParams, type SummaryManagedRulesParams as SummaryManagedRulesParams, type SummaryMitigationProductParams as SummaryMitigationProductParams, type SummaryVerticalParams as SummaryVerticalParams, };
}
//# sourceMappingURL=summary.d.ts.map