// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import * as DNSAPI from '../../dns';

export class Bytimes extends APIResource {
  /**
   * Retrieves a list of aggregate metrics grouped by time interval.
   *
   * See
   * [Analytics API properties](https://developers.cloudflare.com/dns/reference/analytics-api-properties/)
   * for detailed information about the available query parameters.
   *
   * @example
   * ```ts
   * const byTime =
   *   await client.dns.analytics.reports.bytimes.get({
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  get(params: BytimeGetParams, options?: Core.RequestOptions): Core.APIPromise<ByTime> {
    const { zone_id, ...query } = params;
    return (
      this._client.get(`/zones/${zone_id}/dns_analytics/report/bytime`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: ByTime }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface ByTime {
  /**
   * Array with one row per combination of dimension values.
   */
  data: Array<ByTime.Data>;

  /**
   * Number of seconds between current time and last processed event, in another
   * words how many seconds of data could be missing.
   */
  data_lag: number;

  /**
   * Maximum results for each metric (object mapping metric names to values).
   * Currently always an empty object.
   */
  max: unknown;

  /**
   * Minimum results for each metric (object mapping metric names to values).
   * Currently always an empty object.
   */
  min: unknown;

  query: DNSAPI.DNSAnalyticsQuery;

  /**
   * Total number of rows in the result.
   */
  rows: number;

  /**
   * Array of time intervals in the response data. Each interval is represented as an
   * array containing two values: the start time, and the end time.
   */
  time_intervals: Array<Array<string>>;

  /**
   * Total results for metrics across all data (object mapping metric names to
   * values).
   */
  totals: unknown;
}

export namespace ByTime {
  export interface Data {
    /**
     * Array of dimension values, representing the combination of dimension values
     * corresponding to this row.
     */
    dimensions: Array<string>;

    /**
     * Array with one item per requested metric. Each item is an array of values,
     * broken down by time interval.
     */
    metrics: Array<DNSAPI.DNSAnalyticsNominalMetric>;
  }
}

export interface BytimeGetParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Query param: A comma-separated list of dimensions to group results by.
   */
  dimensions?: string;

  /**
   * Query param: Segmentation filter in 'attribute operator value' format.
   */
  filters?: string;

  /**
   * Query param: Limit number of returned metrics.
   */
  limit?: number;

  /**
   * Query param: A comma-separated list of metrics to query.
   */
  metrics?: string;

  /**
   * Query param: Start date and time of requesting data period in ISO 8601 format.
   */
  since?: string;

  /**
   * Query param: A comma-separated list of dimensions to sort by, where each
   * dimension may be prefixed by - (descending) or + (ascending).
   */
  sort?: string;

  /**
   * Query param: Unit of time to group data by.
   */
  time_delta?:
    | 'all'
    | 'auto'
    | 'year'
    | 'quarter'
    | 'month'
    | 'week'
    | 'day'
    | 'hour'
    | 'dekaminute'
    | 'minute';

  /**
   * Query param: End date and time of requesting data period in ISO 8601 format.
   */
  until?: string;
}

export declare namespace Bytimes {
  export { type ByTime as ByTime, type BytimeGetParams as BytimeGetParams };
}
