import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as IPsAPI from "./ips.js";
import { IPTimeseriesParams, IPTimeseriesResponse, IPs } from "./ips.js";
import * as RoutesAPI from "./routes.js";
import { RouteAsesParams, RouteAsesResponse, RouteMoasParams, RouteMoasResponse, RoutePfx2asParams, RoutePfx2asResponse, RouteRealtimeParams, RouteRealtimeResponse, RouteStatsParams, RouteStatsResponse, Routes } from "./routes.js";
import * as HijacksAPI from "./hijacks/hijacks.js";
import { Hijacks } from "./hijacks/hijacks.js";
import * as LeaksAPI from "./leaks/leaks.js";
import { Leaks } from "./leaks/leaks.js";
import * as TopAPI from "./top/top.js";
import { Top, TopPrefixesParams, TopPrefixesResponse } from "./top/top.js";
export declare class BGP extends APIResource {
    leaks: LeaksAPI.Leaks;
    top: TopAPI.Top;
    hijacks: HijacksAPI.Hijacks;
    routes: RoutesAPI.Routes;
    ips: IPsAPI.IPs;
    /**
     * Retrieves BGP updates over time. When requesting updates for an autonomous
     * system, only BGP updates of type announcement are returned.
     *
     * @example
     * ```ts
     * const response = await client.radar.bgp.timeseries();
     * ```
     */
    timeseries(query?: BGPTimeseriesParams, options?: Core.RequestOptions): Core.APIPromise<BGPTimeseriesResponse>;
    timeseries(options?: Core.RequestOptions): Core.APIPromise<BGPTimeseriesResponse>;
}
export interface BGPTimeseriesResponse {
    meta: BGPTimeseriesResponse.Meta;
    serie_0: BGPTimeseriesResponse.Serie0;
}
export declare namespace BGPTimeseriesResponse {
    interface Meta {
        aggInterval: '15m' | '1h' | '1d' | '1w';
        confidenceInfo: Meta.ConfidenceInfo;
        dateRange: Array<Meta.DateRange>;
        lastUpdated: string;
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
    }
    interface Serie0 {
        timestamps: Array<string>;
        values: Array<string>;
    }
}
export interface BGPTimeseriesParams {
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
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
    /**
     * Filters results by BGP network prefix.
     */
    prefix?: Array<string>;
    /**
     * Filters results by BGP update type.
     */
    updateType?: Array<'ANNOUNCEMENT' | 'WITHDRAWAL'>;
}
export declare namespace BGP {
    export { type BGPTimeseriesResponse as BGPTimeseriesResponse, type BGPTimeseriesParams as BGPTimeseriesParams, };
    export { Leaks as Leaks };
    export { Top as Top, type TopPrefixesResponse as TopPrefixesResponse, type TopPrefixesParams as TopPrefixesParams, };
    export { Hijacks as Hijacks };
    export { Routes as Routes, type RouteAsesResponse as RouteAsesResponse, type RouteMoasResponse as RouteMoasResponse, type RoutePfx2asResponse as RoutePfx2asResponse, type RouteRealtimeResponse as RouteRealtimeResponse, type RouteStatsResponse as RouteStatsResponse, type RouteAsesParams as RouteAsesParams, type RouteMoasParams as RouteMoasParams, type RoutePfx2asParams as RoutePfx2asParams, type RouteRealtimeParams as RouteRealtimeParams, type RouteStatsParams as RouteStatsParams, };
    export { IPs as IPs, type IPTimeseriesResponse as IPTimeseriesResponse, type IPTimeseriesParams as IPTimeseriesParams, };
}
//# sourceMappingURL=bgp.d.ts.map