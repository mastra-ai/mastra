// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as BytimesAPI from "./bytimes.mjs";
import { Bytimes } from "./bytimes.mjs";
export class Reports extends APIResource {
    constructor() {
        super(...arguments);
        this.bytimes = new BytimesAPI.Bytimes(this._client);
    }
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
    get(params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/dns_analytics/report`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
Reports.Bytimes = Bytimes;
//# sourceMappingURL=reports.mjs.map