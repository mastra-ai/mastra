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
     *   await client.dnsFirewall.analytics.reports.bytimes.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(dnsFirewallId, params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/dns_firewall/${dnsFirewallId}/dns_analytics/report/bytime`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=bytimes.mjs.map