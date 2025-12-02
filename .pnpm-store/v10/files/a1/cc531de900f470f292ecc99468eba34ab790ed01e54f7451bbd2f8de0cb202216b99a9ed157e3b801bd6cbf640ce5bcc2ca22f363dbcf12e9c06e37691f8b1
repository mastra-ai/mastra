// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
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
    get(params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/dns_analytics/report/bytime`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=bytimes.mjs.map