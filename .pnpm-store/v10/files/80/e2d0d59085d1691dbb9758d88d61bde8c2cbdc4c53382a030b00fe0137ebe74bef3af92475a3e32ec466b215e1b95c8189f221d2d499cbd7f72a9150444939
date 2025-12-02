// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import { isRequestOptions } from '../../../core';
import * as Core from '../../../core';

export class InternetServices extends APIResource {
  /**
   * Retrieves the list of Internet services categories.
   *
   * @example
   * ```ts
   * const response =
   *   await client.radar.ranking.internetServices.categories();
   * ```
   */
  categories(
    query?: InternetServiceCategoriesParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<InternetServiceCategoriesResponse>;
  categories(options?: Core.RequestOptions): Core.APIPromise<InternetServiceCategoriesResponse>;
  categories(
    query: InternetServiceCategoriesParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<InternetServiceCategoriesResponse> {
    if (isRequestOptions(query)) {
      return this.categories({}, query);
    }
    return (
      this._client.get('/radar/ranking/internet_services/categories', {
        query,
        ...options,
      }) as Core.APIPromise<{ result: InternetServiceCategoriesResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieves Internet Services rank update changes over time.
   *
   * @example
   * ```ts
   * const response =
   *   await client.radar.ranking.internetServices.timeseriesGroups();
   * ```
   */
  timeseriesGroups(
    query?: InternetServiceTimeseriesGroupsParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<InternetServiceTimeseriesGroupsResponse>;
  timeseriesGroups(options?: Core.RequestOptions): Core.APIPromise<InternetServiceTimeseriesGroupsResponse>;
  timeseriesGroups(
    query: InternetServiceTimeseriesGroupsParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<InternetServiceTimeseriesGroupsResponse> {
    if (isRequestOptions(query)) {
      return this.timeseriesGroups({}, query);
    }
    return (
      this._client.get('/radar/ranking/internet_services/timeseries_groups', {
        query,
        ...options,
      }) as Core.APIPromise<{ result: InternetServiceTimeseriesGroupsResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieves top Internet services based on their rank.
   *
   * @example
   * ```ts
   * const response =
   *   await client.radar.ranking.internetServices.top();
   * ```
   */
  top(
    query?: InternetServiceTopParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<InternetServiceTopResponse>;
  top(options?: Core.RequestOptions): Core.APIPromise<InternetServiceTopResponse>;
  top(
    query: InternetServiceTopParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<InternetServiceTopResponse> {
    if (isRequestOptions(query)) {
      return this.top({}, query);
    }
    return (
      this._client.get('/radar/ranking/internet_services/top', { query, ...options }) as Core.APIPromise<{
        result: InternetServiceTopResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface InternetServiceCategoriesResponse {
  categories_0: Array<InternetServiceCategoriesResponse.Categories0>;
}

export namespace InternetServiceCategoriesResponse {
  export interface Categories0 {
    name: string;
  }
}

export interface InternetServiceTimeseriesGroupsResponse {
  /**
   * Metadata for the results.
   */
  meta: InternetServiceTimeseriesGroupsResponse.Meta;

  serie_0: InternetServiceTimeseriesGroupsResponse.Serie0;
}

export namespace InternetServiceTimeseriesGroupsResponse {
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

  export interface Serie0 {
    timestamps: Array<string>;

    [k: string]: Array<string | number> | Array<string> | undefined;
  }
}

export interface InternetServiceTopResponse {
  meta: InternetServiceTopResponse.Meta;

  top_0: Array<InternetServiceTopResponse.Top0>;
}

export namespace InternetServiceTopResponse {
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

    service: string;
  }
}

export interface InternetServiceCategoriesParams {
  /**
   * Filters results by the specified array of dates.
   */
  date?: Array<string>;

  /**
   * Format in which results will be returned.
   */
  format?: 'JSON' | 'CSV';

  /**
   * Limits the number of objects returned in the response.
   */
  limit?: number;

  /**
   * Array of names used to label the series in the response.
   */
  name?: Array<string>;
}

export interface InternetServiceTimeseriesGroupsParams {
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
   * Limits the number of objects returned in the response.
   */
  limit?: number;

  /**
   * Array of names used to label the series in the response.
   */
  name?: Array<string>;

  /**
   * Filters results by Internet service category.
   */
  serviceCategory?: Array<string>;
}

export interface InternetServiceTopParams {
  /**
   * Filters results by the specified array of dates.
   */
  date?: Array<string>;

  /**
   * Format in which results will be returned.
   */
  format?: 'JSON' | 'CSV';

  /**
   * Limits the number of objects returned in the response.
   */
  limit?: number;

  /**
   * Array of names used to label the series in the response.
   */
  name?: Array<string>;

  /**
   * Filters results by Internet service category.
   */
  serviceCategory?: Array<string>;
}

export declare namespace InternetServices {
  export {
    type InternetServiceCategoriesResponse as InternetServiceCategoriesResponse,
    type InternetServiceTimeseriesGroupsResponse as InternetServiceTimeseriesGroupsResponse,
    type InternetServiceTopResponse as InternetServiceTopResponse,
    type InternetServiceCategoriesParams as InternetServiceCategoriesParams,
    type InternetServiceTimeseriesGroupsParams as InternetServiceTimeseriesGroupsParams,
    type InternetServiceTopParams as InternetServiceTopParams,
  };
}
