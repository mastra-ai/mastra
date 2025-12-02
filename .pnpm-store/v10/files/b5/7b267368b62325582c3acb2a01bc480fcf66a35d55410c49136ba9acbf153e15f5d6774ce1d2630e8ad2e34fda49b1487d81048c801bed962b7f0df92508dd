// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import { isRequestOptions } from '../../../core';
import * as Core from '../../../core';

export class IPs extends APIResource {
  /**
   * Retrieves time series data for the announced IP space count, represented as the
   * number of IPv4 /24s and IPv6 /48s, for a given ASN.
   *
   * @example
   * ```ts
   * const response = await client.radar.bgp.ips.timeseries();
   * ```
   */
  timeseries(
    query?: IPTimeseriesParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<IPTimeseriesResponse>;
  timeseries(options?: Core.RequestOptions): Core.APIPromise<IPTimeseriesResponse>;
  timeseries(
    query: IPTimeseriesParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<IPTimeseriesResponse> {
    if (isRequestOptions(query)) {
      return this.timeseries({}, query);
    }
    return (
      this._client.get('/radar/bgp/ips/timeseries', { query, ...options }) as Core.APIPromise<{
        result: IPTimeseriesResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface IPTimeseriesResponse {
  /**
   * Metadata for the results.
   */
  meta: IPTimeseriesResponse.Meta;

  serie_0: IPTimeseriesResponse.Serie0;
}

export namespace IPTimeseriesResponse {
  /**
   * Metadata for the results.
   */
  export interface Meta {
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
    normalization:
      | 'PERCENTAGE'
      | 'MIN0_MAX'
      | 'MIN_MAX'
      | 'RAW_VALUES'
      | 'PERCENTAGE_CHANGE'
      | 'ROLLING_AVERAGE'
      | 'OVERLAPPED_PERCENTAGE'
      | 'RATIO';

    /**
     * Measurement units for the results.
     */
    units: Array<Meta.Unit>;

    delay?: Meta.Delay;
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

    export interface Unit {
      name: string;

      value: string;
    }

    export interface Delay {
      asn_data: Delay.ASNData;

      country_data: Delay.CountryData;

      healthy: boolean;

      nowTs: number;
    }

    export namespace Delay {
      export interface ASNData {
        delaySecs: number;

        delayStr: string;

        healthy: boolean;

        latest: ASNData.Latest;
      }

      export namespace ASNData {
        export interface Latest {
          entries_count: number;

          path: string;

          timestamp: number;
        }
      }

      export interface CountryData {
        delaySecs: number;

        delayStr: string;

        healthy: boolean;

        latest: CountryData.Latest;
      }

      export namespace CountryData {
        export interface Latest {
          count: number;

          timestamp: number;
        }
      }
    }
  }

  export interface Serie0 {
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
