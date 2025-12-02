import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as BytimesAPI from "./bytimes.js";
import { BytimeGetParams, Bytimes } from "./bytimes.js";
import * as ReportsReportsAPI from "../../../dns/analytics/reports/reports.js";
export declare class Reports extends APIResource {
    bytimes: BytimesAPI.Bytimes;
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
    get(dnsFirewallId: string, params: ReportGetParams, options?: Core.RequestOptions): Core.APIPromise<ReportsReportsAPI.Report>;
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
export declare namespace Reports {
    export { type ReportGetParams as ReportGetParams };
    export { Bytimes as Bytimes, type BytimeGetParams as BytimeGetParams };
}
//# sourceMappingURL=reports.d.ts.map