// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import { isRequestOptions } from '../../../../core';
import * as Core from '../../../../core';
import * as UserAgentsAPI from './user-agents';
import { UserAgentDirectiveParams, UserAgentDirectiveResponse, UserAgents } from './user-agents';

export class Top extends APIResource {
  userAgents: UserAgentsAPI.UserAgents = new UserAgentsAPI.UserAgents(this._client);

  /**
   * Retrieves the top domain categories by the number of robots.txt files parsed.
   *
   * @example
   * ```ts
   * const response =
   *   await client.radar.robotsTXT.top.domainCategories();
   * ```
   */
  domainCategories(
    query?: TopDomainCategoriesParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TopDomainCategoriesResponse>;
  domainCategories(options?: Core.RequestOptions): Core.APIPromise<TopDomainCategoriesResponse>;
  domainCategories(
    query: TopDomainCategoriesParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<TopDomainCategoriesResponse> {
    if (isRequestOptions(query)) {
      return this.domainCategories({}, query);
    }
    return (
      this._client.get('/radar/robots_txt/top/domain_categories', { query, ...options }) as Core.APIPromise<{
        result: TopDomainCategoriesResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface TopDomainCategoriesResponse {
  /**
   * Metadata for the results.
   */
  meta: TopDomainCategoriesResponse.Meta;

  top_0: Array<TopDomainCategoriesResponse.Top0>;
}

export namespace TopDomainCategoriesResponse {
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
    name: string;

    value: number;
  }
}

export interface TopDomainCategoriesParams {
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
   * Filters results by user agent category.
   */
  userAgentCategory?: 'AI';
}

Top.UserAgents = UserAgents;

export declare namespace Top {
  export {
    type TopDomainCategoriesResponse as TopDomainCategoriesResponse,
    type TopDomainCategoriesParams as TopDomainCategoriesParams,
  };

  export {
    UserAgents as UserAgents,
    type UserAgentDirectiveResponse as UserAgentDirectiveResponse,
    type UserAgentDirectiveParams as UserAgentDirectiveParams,
  };
}
