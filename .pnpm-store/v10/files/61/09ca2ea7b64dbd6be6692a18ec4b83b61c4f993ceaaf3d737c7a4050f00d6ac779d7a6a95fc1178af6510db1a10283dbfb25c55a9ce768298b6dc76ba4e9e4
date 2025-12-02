// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import * as BytimesAPI from './bytimes';
import { BytimeGetParams, Bytimes } from './bytimes';
import * as ReportsReportsAPI from '../../../dns/analytics/reports/reports';

export class Reports extends APIResource {
  bytimes: BytimesAPI.Bytimes = new BytimesAPI.Bytimes(this._client);

  /**
   * Retrieves a list of summarised aggregate metrics over a given time period.
   *
   * See
   * [Analytics API properties](https://developers.cloudflare.com/dns/reference/analytics-api-properties/)
   * for detailed information about the available query parameters.
   *
   * @example
   * ```ts
   * const report =
   *   await client.dnsFirewall.analytics.reports.get(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    dnsFirewallId: string,
    params: ReportGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ReportsReportsAPI.Report> {
    const { account_id, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/dns_firewall/${dnsFirewallId}/dns_analytics/report`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: ReportsReportsAPI.Report }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface ReportGetParams {
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
   * Query param: End date and time of requesting data period in ISO 8601 format.
   */
  until?: string;
}

Reports.Bytimes = Bytimes;

export declare namespace Reports {
  export { type ReportGetParams as ReportGetParams };

  export { Bytimes as Bytimes, type BytimeGetParams as BytimeGetParams };
}
