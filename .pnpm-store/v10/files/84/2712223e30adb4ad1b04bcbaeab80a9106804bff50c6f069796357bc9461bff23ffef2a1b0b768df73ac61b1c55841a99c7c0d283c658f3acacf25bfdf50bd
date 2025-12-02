import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as BytimesAPI from "./bytimes.js";
import { ByTime, BytimeGetParams, Bytimes } from "./bytimes.js";
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
     * const report = await client.dns.analytics.reports.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: ReportGetParams, options?: Core.RequestOptions): Core.APIPromise<Report>;
}
export interface Report {
    /**
     * Array with one row per combination of dimension values.
     */
    data: Array<Report.Data>;
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
    query: Report.Query;
    /**
     * Total number of rows in the result.
     */
    rows: number;
    /**
     * Total results for metrics across all data (object mapping metric names to
     * values).
     */
    totals: unknown;
}
export declare namespace Report {
    interface Data {
        /**
         * Array of dimension values, representing the combination of dimension values
         * corresponding to this row.
         */
        dimensions: Array<string>;
        /**
         * Array with one item per requested metric. Each item is a single value.
         */
        metrics: Array<number>;
    }
    interface Query {
        /**
         * Array of dimension names.
         */
        dimensions: Array<string>;
        /**
         * Limit number of returned metrics.
         */
        limit: number;
        /**
         * Array of metric names.
         */
        metrics: Array<string>;
        /**
         * Start date and time of requesting data period in ISO 8601 format.
         */
        since: string;
        /**
         * End date and time of requesting data period in ISO 8601 format.
         */
        until: string;
        /**
         * Segmentation filter in 'attribute operator value' format.
         */
        filters?: string;
        /**
         * Array of dimensions to sort by, where each dimension may be prefixed by -
         * (descending) or + (ascending).
         */
        sort?: Array<string>;
    }
}
export interface ReportGetParams {
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
     * Query param: End date and time of requesting data period in ISO 8601 format.
     */
    until?: string;
}
export declare namespace Reports {
    export { type Report as Report, type ReportGetParams as ReportGetParams };
    export { Bytimes as Bytimes, type ByTime as ByTime, type BytimeGetParams as BytimeGetParams };
}
//# sourceMappingURL=reports.d.ts.map