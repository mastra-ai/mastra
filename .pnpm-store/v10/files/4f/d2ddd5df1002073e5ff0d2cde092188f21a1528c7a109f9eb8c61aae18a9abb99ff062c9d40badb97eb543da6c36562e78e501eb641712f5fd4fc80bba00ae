// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import { isRequestOptions } from '../../../core';
import * as Core from '../../../core';
import * as IPsAPI from './ips';
import { IPTimeseriesParams, IPTimeseriesResponse, IPs } from './ips';
import * as RoutesAPI from './routes';
import {
  RouteAsesParams,
  RouteAsesResponse,
  RouteMoasParams,
  RouteMoasResponse,
  RoutePfx2asParams,
  RoutePfx2asResponse,
  RouteRealtimeParams,
  RouteRealtimeResponse,
  RouteStatsParams,
  RouteStatsResponse,
  Routes,
} from './routes';
import * as HijacksAPI from './hijacks/hijacks';
import { Hijacks } from './hijacks/hijacks';
import * as LeaksAPI from './leaks/leaks';
import { Leaks } from './leaks/leaks';
import * as TopAPI from './top/top';
import { Top, TopPrefixesParams, TopPrefixesResponse } from './top/top';

export class BGP extends APIResource {
  leaks: LeaksAPI.Leaks = new LeaksAPI.Leaks(this._client);
  top: TopAPI.Top = new TopAPI.Top(this._client);
  hijacks: HijacksAPI.Hijacks = new HijacksAPI.Hijacks(this._client);
  routes: RoutesAPI.Routes = new RoutesAPI.Routes(this._client);
  ips: IPsAPI.IPs = new IPsAPI.IPs(this._client);

  /**
   * Retrieves BGP updates over time. When requesting updates for an autonomous
   * system, only BGP updates of type announcement are returned.
   *
   * @example
   * ```ts
   * const response = await client.radar.bgp.timeseries();
   * ```
   */
  timeseries(
    query?: BGPTimeseriesParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<BGPTimeseriesResponse>;
  timeseries(options?: Core.RequestOptions): Core.APIPromise<BGPTimeseriesResponse>;
  timeseries(
    query: BGPTimeseriesParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<BGPTimeseriesResponse> {
    if (isRequestOptions(query)) {
      return this.timeseries({}, query);
    }
    return (
      this._client.get('/radar/bgp/timeseries', { query, ...options }) as Core.APIPromise<{
        result: BGPTimeseriesResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface BGPTimeseriesResponse {
  meta: BGPTimeseriesResponse.Meta;

  serie_0: BGPTimeseriesResponse.Serie0;
}

export namespace BGPTimeseriesResponse {
  export interface Meta {
    aggInterval: '15m' | '1h' | '1d' | '1w';

    confidenceInfo: Meta.ConfidenceInfo;

    dateRange: Array<Meta.DateRange>;

    lastUpdated: string;
  }

  export namespace Meta {
    export interface ConfidenceInfo {
      annotations: Array<ConfidenceInfo.Annotation>;

      /**
       * Provides an indication of how much confidence Cloudflare has in the data.
       */
      level: number;
    }

    export namespace ConfidenceInfo {
      /**
       * Annotation associated with the result (e.g. outage or other type of event).
       */
      export interface Annotation {
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

    export interface DateRange {
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

  export interface Serie0 {
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

BGP.Leaks = Leaks;
BGP.Top = Top;
BGP.Hijacks = Hijacks;
BGP.Routes = Routes;
BGP.IPs = IPs;

export declare namespace BGP {
  export {
    type BGPTimeseriesResponse as BGPTimeseriesResponse,
    type BGPTimeseriesParams as BGPTimeseriesParams,
  };

  export { Leaks as Leaks };

  export {
    Top as Top,
    type TopPrefixesResponse as TopPrefixesResponse,
    type TopPrefixesParams as TopPrefixesParams,
  };

  export { Hijacks as Hijacks };

  export {
    Routes as Routes,
    type RouteAsesResponse as RouteAsesResponse,
    type RouteMoasResponse as RouteMoasResponse,
    type RoutePfx2asResponse as RoutePfx2asResponse,
    type RouteRealtimeResponse as RouteRealtimeResponse,
    type RouteStatsResponse as RouteStatsResponse,
    type RouteAsesParams as RouteAsesParams,
    type RouteMoasParams as RouteMoasParams,
    type RoutePfx2asParams as RoutePfx2asParams,
    type RouteRealtimeParams as RouteRealtimeParams,
    type RouteStatsParams as RouteStatsParams,
  };

  export {
    IPs as IPs,
    type IPTimeseriesResponse as IPTimeseriesResponse,
    type IPTimeseriesParams as IPTimeseriesParams,
  };
}
