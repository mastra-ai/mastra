// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import { isRequestOptions } from '../../../core';
import * as Core from '../../../core';
import * as DomainAPI from './domain';
import { Domain, DomainGetParams, DomainGetResponse } from './domain';
import * as InternetServicesAPI from './internet-services';
import {
  InternetServiceCategoriesParams,
  InternetServiceCategoriesResponse,
  InternetServiceTimeseriesGroupsParams,
  InternetServiceTimeseriesGroupsResponse,
  InternetServiceTopParams,
  InternetServiceTopResponse,
  InternetServices,
} from './internet-services';

export class Ranking extends APIResource {
  domain: DomainAPI.Domain = new DomainAPI.Domain(this._client);
  internetServices: InternetServicesAPI.InternetServices = new InternetServicesAPI.InternetServices(
    this._client,
  );

  /**
   * Retrieves domains rank over time.
   *
   * @example
   * ```ts
   * const response =
   *   await client.radar.ranking.timeseriesGroups();
   * ```
   */
  timeseriesGroups(
    query?: RankingTimeseriesGroupsParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RankingTimeseriesGroupsResponse>;
  timeseriesGroups(options?: Core.RequestOptions): Core.APIPromise<RankingTimeseriesGroupsResponse>;
  timeseriesGroups(
    query: RankingTimeseriesGroupsParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<RankingTimeseriesGroupsResponse> {
    if (isRequestOptions(query)) {
      return this.timeseriesGroups({}, query);
    }
    return (
      this._client.get('/radar/ranking/timeseries_groups', { query, ...options }) as Core.APIPromise<{
        result: RankingTimeseriesGroupsResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieves the top or trending domains based on their rank. Popular domains are
   * domains of broad appeal based on how people use the Internet. Trending domains
   * are domains that are generating a surge in interest. For more information on top
   * domains, see https://blog.cloudflare.com/radar-domain-rankings/.
   *
   * @example
   * ```ts
   * const response = await client.radar.ranking.top();
   * ```
   */
  top(query?: RankingTopParams, options?: Core.RequestOptions): Core.APIPromise<RankingTopResponse>;
  top(options?: Core.RequestOptions): Core.APIPromise<RankingTopResponse>;
  top(
    query: RankingTopParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<RankingTopResponse> {
    if (isRequestOptions(query)) {
      return this.top({}, query);
    }
    return (
      this._client.get('/radar/ranking/top', { query, ...options }) as Core.APIPromise<{
        result: RankingTopResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface RankingTimeseriesGroupsResponse {
  /**
   * Metadata for the results.
   */
  meta: RankingTimeseriesGroupsResponse.Meta;

  serie_0: RankingTimeseriesGroupsResponse.Serie0;
}

export namespace RankingTimeseriesGroupsResponse {
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

export interface RankingTopResponse {
  meta: RankingTopResponse.Meta;

  top_0: Array<RankingTopResponse.Top0>;
}

export namespace RankingTopResponse {
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
    categories: Array<Top0.Category>;

    domain: string;

    rank: number;

    /**
     * Only available in TRENDING rankings.
     */
    pctRankChange?: number;
  }

  export namespace Top0 {
    export interface Category {
      id: number;

      name: string;

      superCategoryId: number;
    }
  }
}

export interface RankingTimeseriesGroupsParams {
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
   * Filters results by domain category.
   */
  domainCategory?: Array<string>;

  /**
   * Filters results by domain name. Specify a comma-separated list of domain names.
   */
  domains?: Array<string>;

  /**
   * Format in which results will be returned.
   */
  format?: 'JSON' | 'CSV';

  /**
   * Limits the number of objects returned in the response.
   */
  limit?: number;

  /**
   * Filters results by location. Specify a comma-separated list of alpha-2 location
   * codes.
   */
  location?: Array<string>;

  /**
   * Array of names used to label the series in the response.
   */
  name?: Array<string>;

  /**
   * The ranking type.
   */
  rankingType?: 'POPULAR' | 'TRENDING_RISE' | 'TRENDING_STEADY';
}

export interface RankingTopParams {
  /**
   * Filters results by the specified array of dates.
   */
  date?: Array<string>;

  /**
   * Filters results by domain category.
   */
  domainCategory?: Array<string>;

  /**
   * Format in which results will be returned.
   */
  format?: 'JSON' | 'CSV';

  /**
   * Limits the number of objects returned in the response.
   */
  limit?: number;

  /**
   * Filters results by location. Specify a comma-separated list of alpha-2 location
   * codes.
   */
  location?: Array<string>;

  /**
   * Array of names used to label the series in the response.
   */
  name?: Array<string>;

  /**
   * The ranking type.
   */
  rankingType?: 'POPULAR' | 'TRENDING_RISE' | 'TRENDING_STEADY';
}

Ranking.Domain = Domain;
Ranking.InternetServices = InternetServices;

export declare namespace Ranking {
  export {
    type RankingTimeseriesGroupsResponse as RankingTimeseriesGroupsResponse,
    type RankingTopResponse as RankingTopResponse,
    type RankingTimeseriesGroupsParams as RankingTimeseriesGroupsParams,
    type RankingTopParams as RankingTopParams,
  };

  export {
    Domain as Domain,
    type DomainGetResponse as DomainGetResponse,
    type DomainGetParams as DomainGetParams,
  };

  export {
    InternetServices as InternetServices,
    type InternetServiceCategoriesResponse as InternetServiceCategoriesResponse,
    type InternetServiceTimeseriesGroupsResponse as InternetServiceTimeseriesGroupsResponse,
    type InternetServiceTopResponse as InternetServiceTopResponse,
    type InternetServiceCategoriesParams as InternetServiceCategoriesParams,
    type InternetServiceTimeseriesGroupsParams as InternetServiceTimeseriesGroupsParams,
    type InternetServiceTopParams as InternetServiceTopParams,
  };
}
