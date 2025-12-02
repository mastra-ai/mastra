import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class Summary extends APIResource {
    /**
     * Retrieves the distribution of layer 3 attacks by bitrate.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer3.summary.bitrate();
     * ```
     */
    bitrate(query?: SummaryBitrateParams, options?: Core.RequestOptions): Core.APIPromise<SummaryBitrateResponse>;
    bitrate(options?: Core.RequestOptions): Core.APIPromise<SummaryBitrateResponse>;
    /**
     * Retrieves the distribution of layer 3 attacks by duration.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer3.summary.duration();
     * ```
     */
    duration(query?: SummaryDurationParams, options?: Core.RequestOptions): Core.APIPromise<SummaryDurationResponse>;
    duration(options?: Core.RequestOptions): Core.APIPromise<SummaryDurationResponse>;
    /**
     * Retrieves the distribution of layer 3 attacks by targeted industry.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer3.summary.industry();
     * ```
     */
    industry(query?: SummaryIndustryParams, options?: Core.RequestOptions): Core.APIPromise<SummaryIndustryResponse>;
    industry(options?: Core.RequestOptions): Core.APIPromise<SummaryIndustryResponse>;
    /**
     * Retrieves the distribution of layer 3 attacks by IP version.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer3.summary.ipVersion();
     * ```
     */
    ipVersion(query?: SummaryIPVersionParams, options?: Core.RequestOptions): Core.APIPromise<SummaryIPVersionResponse>;
    ipVersion(options?: Core.RequestOptions): Core.APIPromise<SummaryIPVersionResponse>;
    /**
     * Retrieves the distribution of layer 3 attacks by protocol.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer3.summary.protocol();
     * ```
     */
    protocol(query?: SummaryProtocolParams, options?: Core.RequestOptions): Core.APIPromise<SummaryProtocolResponse>;
    protocol(options?: Core.RequestOptions): Core.APIPromise<SummaryProtocolResponse>;
    /**
     * Retrieves the distribution of layer 3 attacks by vector.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer3.summary.vector();
     * ```
     */
    vector(query?: SummaryVectorParams, options?: Core.RequestOptions): Core.APIPromise<SummaryVectorResponse>;
    vector(options?: Core.RequestOptions): Core.APIPromise<SummaryVectorResponse>;
    /**
     * Retrieves the distribution of layer 3 attacks by targeted vertical.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer3.summary.vertical();
     * ```
     */
    vertical(query?: SummaryVerticalParams, options?: Core.RequestOptions): Core.APIPromise<SummaryVerticalResponse>;
    vertical(options?: Core.RequestOptions): Core.APIPromise<SummaryVerticalResponse>;
}
export interface SummaryBitrateResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryBitrateResponse.Meta;
    summary_0: SummaryBitrateResponse.Summary0;
}
export declare namespace SummaryBitrateResponse {
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
        _1_GBPS_TO_10_GBPS: string;
        /**
         * A numeric string.
         */
        _10_GBPS_TO_100_GBPS: string;
        /**
         * A numeric string.
         */
        _500_MBPS_TO_1_GBPS: string;
        /**
         * A numeric string.
         */
        OVER_100_GBPS: string;
        /**
         * A numeric string.
         */
        UNDER_500_MBPS: string;
    }
}
export interface SummaryDurationResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryDurationResponse.Meta;
    summary_0: SummaryDurationResponse.Summary0;
}
export declare namespace SummaryDurationResponse {
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
        _1_HOUR_TO_3_HOURS: string;
        /**
         * A numeric string.
         */
        _10_MINS_TO_20_MINS: string;
        /**
         * A numeric string.
         */
        _20_MINS_TO_40_MINS: string;
        /**
         * A numeric string.
         */
        _40_MINS_TO_1_HOUR: string;
        /**
         * A numeric string.
         */
        OVER_3_HOURS: string;
        /**
         * A numeric string.
         */
        UNDER_10_MINS: string;
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
        /**
         * A numeric string.
         */
        IPv4: string;
        /**
         * A numeric string.
         */
        IPv6: string;
    }
}
export interface SummaryProtocolResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryProtocolResponse.Meta;
    summary_0: SummaryProtocolResponse.Summary0;
}
export declare namespace SummaryProtocolResponse {
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
        GRE: string;
        /**
         * A numeric string.
         */
        ICMP: string;
        /**
         * A numeric string.
         */
        TCP: string;
        /**
         * A numeric string.
         */
        UDP: string;
    }
}
export interface SummaryVectorResponse {
    /**
     * Metadata for the results.
     */
    meta: SummaryVectorResponse.Meta;
    summary_0: {
        [key: string]: string;
    };
}
export declare namespace SummaryVectorResponse {
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
export interface SummaryBitrateParams {
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
     * Specifies whether the `location` filter applies to the source or target
     * location.
     */
    direction?: 'ORIGIN' | 'TARGET';
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
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
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters the results by layer 3/4 protocol.
     */
    protocol?: Array<'UDP' | 'TCP' | 'ICMP' | 'GRE'>;
}
export interface SummaryDurationParams {
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
     * Specifies whether the `location` filter applies to the source or target
     * location.
     */
    direction?: 'ORIGIN' | 'TARGET';
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
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
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters the results by layer 3/4 protocol.
     */
    protocol?: Array<'UDP' | 'TCP' | 'ICMP' | 'GRE'>;
}
export interface SummaryIndustryParams {
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
     * Specifies whether the `location` filter applies to the source or target
     * location.
     */
    direction?: 'ORIGIN' | 'TARGET';
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
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
     * Filters the results by layer 3/4 protocol.
     */
    protocol?: Array<'UDP' | 'TCP' | 'ICMP' | 'GRE'>;
}
export interface SummaryIPVersionParams {
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
     * Specifies whether the `location` filter applies to the source or target
     * location.
     */
    direction?: 'ORIGIN' | 'TARGET';
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
     * Filters the results by layer 3/4 protocol.
     */
    protocol?: Array<'UDP' | 'TCP' | 'ICMP' | 'GRE'>;
}
export interface SummaryProtocolParams {
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
     * Specifies whether the `location` filter applies to the source or target
     * location.
     */
    direction?: 'ORIGIN' | 'TARGET';
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
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
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
}
export interface SummaryVectorParams {
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
     * Specifies whether the `location` filter applies to the source or target
     * location.
     */
    direction?: 'ORIGIN' | 'TARGET';
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
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
     * Filters the results by layer 3/4 protocol.
     */
    protocol?: Array<'UDP' | 'TCP' | 'ICMP' | 'GRE'>;
}
export interface SummaryVerticalParams {
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
     * Specifies whether the `location` filter applies to the source or target
     * location.
     */
    direction?: 'ORIGIN' | 'TARGET';
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
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
     * Filters the results by layer 3/4 protocol.
     */
    protocol?: Array<'UDP' | 'TCP' | 'ICMP' | 'GRE'>;
}
export declare namespace Summary {
    export { type SummaryBitrateResponse as SummaryBitrateResponse, type SummaryDurationResponse as SummaryDurationResponse, type SummaryIndustryResponse as SummaryIndustryResponse, type SummaryIPVersionResponse as SummaryIPVersionResponse, type SummaryProtocolResponse as SummaryProtocolResponse, type SummaryVectorResponse as SummaryVectorResponse, type SummaryVerticalResponse as SummaryVerticalResponse, type SummaryBitrateParams as SummaryBitrateParams, type SummaryDurationParams as SummaryDurationParams, type SummaryIndustryParams as SummaryIndustryParams, type SummaryIPVersionParams as SummaryIPVersionParams, type SummaryProtocolParams as SummaryProtocolParams, type SummaryVectorParams as SummaryVectorParams, type SummaryVerticalParams as SummaryVerticalParams, };
}
//# sourceMappingURL=summary.d.ts.map