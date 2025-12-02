import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class IPs extends APIResource {
    /**
     * Retrieves time series data for the announced IP space count, represented as the
     * number of IPv4 /24s and IPv6 /48s, for a given ASN.
     *
     * @example
     * ```ts
     * const response = await client.radar.bgp.ips.timeseries();
     * ```
     */
    timeseries(query?: IPTimeseriesParams, options?: Core.RequestOptions): Core.APIPromise<IPTimeseriesResponse>;
    timeseries(options?: Core.RequestOptions): Core.APIPromise<IPTimeseriesResponse>;
}
export interface IPTimeseriesResponse {
    /**
     * Metadata for the results.
     */
    meta: IPTimeseriesResponse.Meta;
    serie_0: IPTimeseriesResponse.Serie0;
}
export declare namespace IPTimeseriesResponse {
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
        delay?: Meta.Delay;
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
        interface Delay {
            asn_data: Delay.ASNData;
            country_data: Delay.CountryData;
            healthy: boolean;
            nowTs: number;
        }
        namespace Delay {
            interface ASNData {
                delaySecs: number;
                delayStr: string;
                healthy: boolean;
                latest: ASNData.Latest;
            }
            namespace ASNData {
                interface Latest {
                    entries_count: number;
                    path: string;
                    timestamp: number;
                }
            }
            interface CountryData {
                delaySecs: number;
                delayStr: string;
                healthy: boolean;
                latest: CountryData.Latest;
            }
            namespace CountryData {
                interface Latest {
                    count: number;
                    timestamp: number;
                }
            }
        }
    }
    interface Serie0 {
        ipv4: Array<string>;
        ipv6: Array<string>;
        timestamps: Array<string>;
    }
}
export interface IPTimeseriesParams {
    /**
     * Filters results by Autonomous System. Specify one or more Autonomous System
     * Numbers (ASNs) as a comma-separated list. Prefix with `-` to exclude ASNs from
     * results. For example, `-174, 3356` excludes results from AS174, but includes
     * results from AS3356.
     */
    asn?: Array<string>;
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
     * Includes data delay meta information.
     */
    includeDelay?: boolean;
    /**
     * Filters results by IP version (Ipv4 vs. IPv6).
     */
    ipVersion?: Array<'IPv4' | 'IPv6'>;
    /**
     * Filters results by location. Specify a comma-separated list of alpha-2 location
     * codes.
     */
    location?: Array<string>;
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
}
export declare namespace IPs {
    export { type IPTimeseriesResponse as IPTimeseriesResponse, type IPTimeseriesParams as IPTimeseriesParams };
}
//# sourceMappingURL=ips.d.ts.map