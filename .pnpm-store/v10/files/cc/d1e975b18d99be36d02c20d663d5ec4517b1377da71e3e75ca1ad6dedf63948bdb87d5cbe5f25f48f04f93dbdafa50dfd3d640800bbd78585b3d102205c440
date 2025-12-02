import { APIResource } from "../../../../../resource.js";
import * as Core from "../../../../../core.js";
import * as LocationsAPI from "./locations.js";
import { LocationOriginParams, LocationOriginResponse, LocationTargetParams, LocationTargetResponse, Locations } from "./locations.js";
export declare class Top extends APIResource {
    locations: LocationsAPI.Locations;
    /**
     * Retrieves the top layer 3 attacks from origin to target location. Values are a
     * percentage out of the total layer 3 attacks (with billing country). You can
     * optionally limit the number of attacks by origin/target location (useful if all
     * the top attacks are from or to the same location).
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.attacks.layer3.top.attacks();
     * ```
     */
    attacks(query?: TopAttacksParams, options?: Core.RequestOptions): Core.APIPromise<TopAttacksResponse>;
    attacks(options?: Core.RequestOptions): Core.APIPromise<TopAttacksResponse>;
    /**
     * This endpoint is deprecated. To continue getting this data, switch to the
     * summary by industry endpoint.
     *
     * @deprecated
     */
    industry(query?: TopIndustryParams, options?: Core.RequestOptions): Core.APIPromise<TopIndustryResponse>;
    industry(options?: Core.RequestOptions): Core.APIPromise<TopIndustryResponse>;
    /**
     * This endpoint is deprecated. To continue getting this data, switch to the
     * summary by vertical endpoint.
     *
     * @deprecated
     */
    vertical(query?: TopVerticalParams, options?: Core.RequestOptions): Core.APIPromise<TopVerticalResponse>;
    vertical(options?: Core.RequestOptions): Core.APIPromise<TopVerticalResponse>;
}
export interface TopAttacksResponse {
    /**
     * Metadata for the results.
     */
    meta: TopAttacksResponse.Meta;
    top_0: Array<TopAttacksResponse.Top0>;
}
export declare namespace TopAttacksResponse {
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
    interface Top0 {
        originCountryAlpha2: string;
        originCountryName: string;
        value: string;
    }
}
export interface TopIndustryResponse {
    /**
     * Metadata for the results.
     */
    meta: TopIndustryResponse.Meta;
    top_0: Array<TopIndustryResponse.Top0>;
}
export declare namespace TopIndustryResponse {
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
    interface Top0 {
        name: string;
        value: string;
    }
}
export interface TopVerticalResponse {
    /**
     * Metadata for the results.
     */
    meta: TopVerticalResponse.Meta;
    top_0: Array<TopVerticalResponse.Top0>;
}
export declare namespace TopVerticalResponse {
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
    interface Top0 {
        name: string;
        value: string;
    }
}
export interface TopAttacksParams {
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
     * Filters results by IP version (Ipv4 vs. IPv6).
     */
    ipVersion?: Array<'IPv4' | 'IPv6'>;
    /**
     * Limits the number of objects returned in the response.
     */
    limit?: number;
    /**
     * Specifies whether the `limitPerLocation` applies to the source or target
     * location.
     */
    limitDirection?: 'ORIGIN' | 'TARGET';
    /**
     * Limits the number of attacks per origin/target (refer to `limitDirection`
     * parameter) location.
     */
    limitPerLocation?: number;
    /**
     * Filters results by location. Specify a comma-separated list of alpha-2 codes.
     * Prefix with `-` to exclude locations from results. For example, `-US,PT`
     * excludes results from the US, but includes results from PT.
     */
    location?: Array<string>;
    /**
     * Orders results based on attack magnitude, defined by total mitigated bytes or
     * total mitigated attacks.
     */
    magnitude?: 'MITIGATED_BYTES' | 'MITIGATED_ATTACKS';
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Normalization method applied to the results. Refer to
     * [Normalization methods](https://developers.cloudflare.com/radar/concepts/normalization/).
     */
    normalization?: 'PERCENTAGE' | 'MIN_MAX';
    /**
     * Filters the results by layer 3/4 protocol.
     */
    protocol?: Array<'UDP' | 'TCP' | 'ICMP' | 'GRE'>;
}
export interface TopIndustryParams {
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
     * Filters results by IP version (Ipv4 vs. IPv6).
     */
    ipVersion?: Array<'IPv4' | 'IPv6'>;
    /**
     * Limits the number of objects returned in the response.
     */
    limit?: number;
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
export interface TopVerticalParams {
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
     * Filters results by IP version (Ipv4 vs. IPv6).
     */
    ipVersion?: Array<'IPv4' | 'IPv6'>;
    /**
     * Limits the number of objects returned in the response.
     */
    limit?: number;
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
export declare namespace Top {
    export { type TopAttacksResponse as TopAttacksResponse, type TopIndustryResponse as TopIndustryResponse, type TopVerticalResponse as TopVerticalResponse, type TopAttacksParams as TopAttacksParams, type TopIndustryParams as TopIndustryParams, type TopVerticalParams as TopVerticalParams, };
    export { Locations as Locations, type LocationOriginResponse as LocationOriginResponse, type LocationTargetResponse as LocationTargetResponse, type LocationOriginParams as LocationOriginParams, type LocationTargetParams as LocationTargetParams, };
}
//# sourceMappingURL=top.d.ts.map