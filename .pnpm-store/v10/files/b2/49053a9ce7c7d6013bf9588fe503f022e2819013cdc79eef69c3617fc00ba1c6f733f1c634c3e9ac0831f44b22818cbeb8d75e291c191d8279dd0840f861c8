// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../../resource';
import { isRequestOptions } from '../../../../../core';
import * as Core from '../../../../../core';

export class Locations extends APIResource {
  /**
   * Retrieves the origin locations of layer 3 attacks.
   *
   * @example
   * ```ts
   * const response =
   *   await client.radar.attacks.layer3.top.locations.origin();
   * ```
   */
  origin(
    query?: LocationOriginParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LocationOriginResponse>;
  origin(options?: Core.RequestOptions): Core.APIPromise<LocationOriginResponse>;
  origin(
    query: LocationOriginParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<LocationOriginResponse> {
    if (isRequestOptions(query)) {
      return this.origin({}, query);
    }
    return (
      this._client.get('/radar/attacks/layer3/top/locations/origin', {
        query,
        ...options,
      }) as Core.APIPromise<{ result: LocationOriginResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieves the target locations of layer 3 attacks.
   *
   * @example
   * ```ts
   * const response =
   *   await client.radar.attacks.layer3.top.locations.target();
   * ```
   */
  target(
    query?: LocationTargetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LocationTargetResponse>;
  target(options?: Core.RequestOptions): Core.APIPromise<LocationTargetResponse>;
  target(
    query: LocationTargetParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<LocationTargetResponse> {
    if (isRequestOptions(query)) {
      return this.target({}, query);
    }
    return (
      this._client.get('/radar/attacks/layer3/top/locations/target', {
        query,
        ...options,
      }) as Core.APIPromise<{ result: LocationTargetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface LocationOriginResponse {
  /**
   * Metadata for the results.
   */
  meta: LocationOriginResponse.Meta;

  top_0: Array<LocationOriginResponse.Top0>;
}

export namespace LocationOriginResponse {
  /**
   * Metadata for the results.
   */
  export interface Meta {
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
  }

  export interface Top0 {
    originCountryAlpha2: string;

    originCountryName: string;

    rank: number;

    value: string;
  }
}

export interface LocationTargetResponse {
  /**
   * Metadata for the results.
   */
  meta: LocationTargetResponse.Meta;

  top_0: Array<LocationTargetResponse.Top0>;
}

export namespace LocationTargetResponse {
  /**
   * Metadata for the results.
   */
  export interface Meta {
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
  }

  export interface Top0 {
    rank: number;

    targetCountryAlpha2: string;

    targetCountryName: string;

    value: string;
  }
}

export interface LocationOriginParams {
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

export interface LocationTargetParams {
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

export declare namespace Locations {
  export {
    type LocationOriginResponse as LocationOriginResponse,
    type LocationTargetResponse as LocationTargetResponse,
    type LocationOriginParams as LocationOriginParams,
    type LocationTargetParams as LocationTargetParams,
  };
}
