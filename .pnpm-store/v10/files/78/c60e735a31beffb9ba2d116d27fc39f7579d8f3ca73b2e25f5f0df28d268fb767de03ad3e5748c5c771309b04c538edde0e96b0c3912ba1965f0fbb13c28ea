// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import * as ReportsBytimesAPI from '../../../dns/analytics/reports/bytimes';

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
   *   await client.dnsFirewall.analytics.reports.bytimes.get(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    dnsFirewallId: string,
    params: BytimeGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ReportsBytimesAPI.ByTime> {
    const { account_id, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/dns_firewall/${dnsFirewallId}/dns_analytics/report/bytime`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: ReportsBytimesAPI.ByTime }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface BytimeGetParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

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
  export { type BytimeGetParams as BytimeGetParams };
}
