// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import { isRequestOptions } from '../../../../core';
import * as Core from '../../../../core';
import * as AsesAPI from './ases';
import { AseGetParams, AseGetResponse, AsePrefixesParams, AsePrefixesResponse, Ases } from './ases';

export class Top extends APIResource {
  ases: AsesAPI.Ases = new AsesAPI.Ases(this._client);

  /**
   * Retrieves the top network prefixes by BGP updates.
   *
   * @example
   * ```ts
   * const response = await client.radar.bgp.top.prefixes();
   * ```
   */
  prefixes(query?: TopPrefixesParams, options?: Core.RequestOptions): Core.APIPromise<TopPrefixesResponse>;
  prefixes(options?: Core.RequestOptions): Core.APIPromise<TopPrefixesResponse>;
  prefixes(
    query: TopPrefixesParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<TopPrefixesResponse> {
    if (isRequestOptions(query)) {
      return this.prefixes({}, query);
    }
    return (
      this._client.get('/radar/bgp/top/prefixes', { query, ...options }) as Core.APIPromise<{
        result: TopPrefixesResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface TopPrefixesResponse {
  meta: TopPrefixesResponse.Meta;

  top_0: Array<TopPrefixesResponse.Top0>;
}

export namespace TopPrefixesResponse {
  export interface Meta {
    dateRange: Array<Meta.DateRange>;
  }

  export namespace Meta {
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

  export interface Top0 {
    prefix: string;

    /**
     * A numeric string.
     */
    value: string;
  }
}

export interface TopPrefixesParams {
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
   * Limits the number of objects returned in the response.
   */
  limit?: number;

  /**
   * Array of names used to label the series in the response.
   */
  name?: Array<string>;

  /**
   * Filters results by BGP update type.
   */
  updateType?: Array<'ANNOUNCEMENT' | 'WITHDRAWAL'>;
}

Top.Ases = Ases;

export declare namespace Top {
  export { type TopPrefixesResponse as TopPrefixesResponse, type TopPrefixesParams as TopPrefixesParams };

  export {
    Ases as Ases,
    type AseGetResponse as AseGetResponse,
    type AsePrefixesResponse as AsePrefixesResponse,
    type AseGetParams as AseGetParams,
    type AsePrefixesParams as AsePrefixesParams,
  };
}
