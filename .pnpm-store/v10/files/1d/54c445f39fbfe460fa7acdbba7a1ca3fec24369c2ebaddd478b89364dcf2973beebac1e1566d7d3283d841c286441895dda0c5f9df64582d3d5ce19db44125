import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Routes extends APIResource {
    /**
     * Retrieves all ASes in the current global routing tables with routing statistics.
     *
     * @example
     * ```ts
     * const response = await client.radar.bgp.routes.ases();
     * ```
     */
    ases(query?: RouteAsesParams, options?: Core.RequestOptions): Core.APIPromise<RouteAsesResponse>;
    ases(options?: Core.RequestOptions): Core.APIPromise<RouteAsesResponse>;
    /**
     * Retrieves all Multi-Origin AS (MOAS) prefixes in the global routing tables.
     *
     * @example
     * ```ts
     * const response = await client.radar.bgp.routes.moas();
     * ```
     */
    moas(query?: RouteMoasParams, options?: Core.RequestOptions): Core.APIPromise<RouteMoasResponse>;
    moas(options?: Core.RequestOptions): Core.APIPromise<RouteMoasResponse>;
    /**
     * Retrieves the prefix-to-ASN mapping from global routing tables.
     *
     * @example
     * ```ts
     * const response = await client.radar.bgp.routes.pfx2as();
     * ```
     */
    pfx2as(query?: RoutePfx2asParams, options?: Core.RequestOptions): Core.APIPromise<RoutePfx2asResponse>;
    pfx2as(options?: Core.RequestOptions): Core.APIPromise<RoutePfx2asResponse>;
    /**
     * Retrieves real-time BGP routes for a prefix, using public real-time data
     * collectors (RouteViews and RIPE RIS).
     *
     * @example
     * ```ts
     * const response = await client.radar.bgp.routes.realtime();
     * ```
     */
    realtime(query?: RouteRealtimeParams, options?: Core.RequestOptions): Core.APIPromise<RouteRealtimeResponse>;
    realtime(options?: Core.RequestOptions): Core.APIPromise<RouteRealtimeResponse>;
    /**
     * Retrieves the BGP routing table stats.
     *
     * @example
     * ```ts
     * const response = await client.radar.bgp.routes.stats();
     * ```
     */
    stats(query?: RouteStatsParams, options?: Core.RequestOptions): Core.APIPromise<RouteStatsResponse>;
    stats(options?: Core.RequestOptions): Core.APIPromise<RouteStatsResponse>;
}
export interface RouteAsesResponse {
    asns: Array<RouteAsesResponse.ASN>;
    meta: RouteAsesResponse.Meta;
}
export declare namespace RouteAsesResponse {
    interface ASN {
        asn: number;
        /**
         * AS's customer cone size.
         */
        coneSize: number;
        /**
         * Alpha-2 code for the AS's registration country.
         */
        country: string;
        /**
         * Number of IPv4 addresses originated by the AS.
         */
        ipv4Count: number;
        /**
         * Number of IPv6 addresses originated by the AS.
         */
        ipv6Count: string;
        /**
         * Name of the AS.
         */
        name: string;
        /**
         * Number of total IP prefixes originated by the AS.
         */
        pfxsCount: number;
        /**
         * Number of RPKI invalid prefixes originated by the AS.
         */
        rpkiInvalid: number;
        /**
         * Number of RPKI unknown prefixes originated by the AS.
         */
        rpkiUnknown: number;
        /**
         * Number of RPKI valid prefixes originated by the AS.
         */
        rpkiValid: number;
    }
    interface Meta {
        /**
         * The timestamp of when the data is generated.
         */
        dataTime: string;
        /**
         * The timestamp of the query.
         */
        queryTime: string;
        /**
         * Total number of route collector peers used to generate this data.
         */
        totalPeers: number;
    }
}
export interface RouteMoasResponse {
    meta: RouteMoasResponse.Meta;
    moas: Array<RouteMoasResponse.Moa>;
}
export declare namespace RouteMoasResponse {
    interface Meta {
        data_time: string;
        query_time: string;
        total_peers: number;
    }
    interface Moa {
        origins: Array<Moa.Origin>;
        prefix: string;
    }
    namespace Moa {
        interface Origin {
            origin: number;
            peer_count: number;
            rpki_validation: string;
        }
    }
}
export interface RoutePfx2asResponse {
    meta: RoutePfx2asResponse.Meta;
    prefix_origins: Array<RoutePfx2asResponse.PrefixOrigin>;
}
export declare namespace RoutePfx2asResponse {
    interface Meta {
        data_time: string;
        query_time: string;
        total_peers: number;
    }
    interface PrefixOrigin {
        origin: number;
        peer_count: number;
        prefix: string;
        rpki_validation: string;
    }
}
export interface RouteRealtimeResponse {
    meta: RouteRealtimeResponse.Meta;
    routes: Array<RouteRealtimeResponse.Route>;
}
export declare namespace RouteRealtimeResponse {
    interface Meta {
        asn_info: Array<Meta.ASNInfo>;
        collectors: Array<Meta.Collector>;
        /**
         * The most recent data timestamp for from the real-time sources.
         */
        data_time: string;
        prefix_origins: Array<Meta.PrefixOrigin>;
        /**
         * The timestamp of this query.
         */
        query_time: string;
    }
    namespace Meta {
        interface ASNInfo {
            /**
             * Name of the autonomous system.
             */
            as_name: string;
            /**
             * AS number.
             */
            asn: number;
            /**
             * Alpha-2 code for the AS's registration country.
             */
            country_code: string;
            /**
             * Organization ID.
             */
            org_id: string;
            /**
             * Organization name.
             */
            org_name: string;
        }
        interface Collector {
            /**
             * Public route collector ID.
             */
            collector: string;
            /**
             * Latest real-time stream timestamp for this collector.
             */
            latest_realtime_ts: string;
            /**
             * Latest RIB dump MRT file timestamp for this collector.
             */
            latest_rib_ts: string;
            /**
             * Latest BGP updates MRT file timestamp for this collector.
             */
            latest_updates_ts: string;
            /**
             * Total number of collector peers used from this collector.
             */
            peers_count: number;
            /**
             * Total number of collector peers used from this collector for IPv4 prefixes.
             */
            peers_v4_count: number;
            /**
             * Total number of collector peers used from this collector for IPv6 prefixes.
             */
            peers_v6_count: number;
        }
        interface PrefixOrigin {
            /**
             * Origin ASN.
             */
            origin: number;
            /**
             * IP prefix of this query.
             */
            prefix: string;
            /**
             * Prefix-origin RPKI validation: valid, invalid, unknown.
             */
            rpki_validation: string;
            /**
             * Total number of peers.
             */
            total_peers: number;
            /**
             * Total number of peers seeing this prefix.
             */
            total_visible: number;
            /**
             * Ratio of peers seeing this prefix to total number of peers.
             */
            visibility: number;
        }
    }
    interface Route {
        /**
         * AS-level path for this route, from collector to origin.
         */
        as_path: Array<number>;
        /**
         * Public collector ID for this route.
         */
        collector: string;
        /**
         * BGP community values.
         */
        communities: Array<string>;
        /**
         * IP prefix of this query.
         */
        prefix: string;
        /**
         * Latest timestamp of change for this route.
         */
        timestamp: string;
    }
}
export interface RouteStatsResponse {
    meta: RouteStatsResponse.Meta;
    stats: RouteStatsResponse.Stats;
}
export declare namespace RouteStatsResponse {
    interface Meta {
        data_time: string;
        query_time: string;
        total_peers: number;
    }
    interface Stats {
        distinct_origins: number;
        distinct_origins_ipv4: number;
        distinct_origins_ipv6: number;
        distinct_prefixes: number;
        distinct_prefixes_ipv4: number;
        distinct_prefixes_ipv6: number;
        routes_invalid: number;
        routes_invalid_ipv4: number;
        routes_invalid_ipv6: number;
        routes_total: number;
        routes_total_ipv4: number;
        routes_total_ipv6: number;
        routes_unknown: number;
        routes_unknown_ipv4: number;
        routes_unknown_ipv6: number;
        routes_valid: number;
        routes_valid_ipv4: number;
        routes_valid_ipv6: number;
    }
}
export interface RouteAsesParams {
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Limits the number of objects returned in the response.
     */
    limit?: number;
    /**
     * Filters results by location. Specify an alpha-2 location code.
     */
    location?: string;
    /**
     * Sorts results by the specified field.
     */
    sortBy?: 'cone' | 'pfxs' | 'ipv4' | 'ipv6' | 'rpki_valid' | 'rpki_invalid' | 'rpki_unknown';
    /**
     * Sort order.
     */
    sortOrder?: 'ASC' | 'DESC';
}
export interface RouteMoasParams {
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Lookup only RPKI invalid MOASes.
     */
    invalid_only?: boolean;
    /**
     * Lookup MOASes originated by the given ASN.
     */
    origin?: number;
    /**
     * Network prefix, IPv4 or IPv6.
     */
    prefix?: string;
}
export interface RoutePfx2asParams {
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Return only results with the longest prefix match for the given prefix. For
     * example, specify a /32 prefix to lookup the origin ASN for an IPv4 address.
     */
    longestPrefixMatch?: boolean;
    /**
     * Lookup prefixes originated by the given ASN.
     */
    origin?: number;
    /**
     * Network prefix, IPv4 or IPv6.
     */
    prefix?: string;
    /**
     * Return only results with matching rpki status: valid, invalid or unknown.
     */
    rpkiStatus?: 'VALID' | 'INVALID' | 'UNKNOWN';
}
export interface RouteRealtimeParams {
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Network prefix, IPv4 or IPv6.
     */
    prefix?: string;
}
export interface RouteStatsParams {
    /**
     * Filters results by Autonomous System. Specify a single Autonomous System Number
     * (ASN) as integer.
     */
    asn?: number;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Filters results by location. Specify an alpha-2 location code.
     */
    location?: string;
}
export declare namespace Routes {
    export { type RouteAsesResponse as RouteAsesResponse, type RouteMoasResponse as RouteMoasResponse, type RoutePfx2asResponse as RoutePfx2asResponse, type RouteRealtimeResponse as RouteRealtimeResponse, type RouteStatsResponse as RouteStatsResponse, type RouteAsesParams as RouteAsesParams, type RouteMoasParams as RouteMoasParams, type RoutePfx2asParams as RoutePfx2asParams, type RouteRealtimeParams as RouteRealtimeParams, type RouteStatsParams as RouteStatsParams, };
}
//# sourceMappingURL=routes.d.ts.map