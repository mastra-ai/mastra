// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as ReverseDNSAPI from "./reverse-dns.mjs";
import { ReverseDNS, } from "./reverse-dns.mjs";
import * as AnalyticsAPI from "./analytics/analytics.mjs";
import { Analytics } from "./analytics/analytics.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class DNSFirewall extends APIResource {
    constructor() {
        super(...arguments);
        this.analytics = new AnalyticsAPI.Analytics(this._client);
        this.reverseDNS = new ReverseDNSAPI.ReverseDNS(this._client);
    }
    /**
     * Create a DNS Firewall cluster
     *
     * @example
     * ```ts
     * const dnsFirewall = await client.dnsFirewall.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'My Awesome DNS Firewall cluster',
     *   upstream_ips: [
     *     '192.0.2.1',
     *     '198.51.100.1',
     *     '2001:DB8:100::CF',
     *   ],
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/dns_firewall`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List DNS Firewall clusters for an account
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const dnsFirewallListResponse of client.dnsFirewall.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/dns_firewall`, DNSFirewallListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Delete a DNS Firewall cluster
     *
     * @example
     * ```ts
     * const dnsFirewall = await client.dnsFirewall.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(dnsFirewallId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/dns_firewall/${dnsFirewallId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Modify the configuration of a DNS Firewall cluster
     *
     * @example
     * ```ts
     * const response = await client.dnsFirewall.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(dnsFirewallId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/dns_firewall/${dnsFirewallId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Show a single DNS Firewall cluster for an account
     *
     * @example
     * ```ts
     * const dnsFirewall = await client.dnsFirewall.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(dnsFirewallId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dns_firewall/${dnsFirewallId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class DNSFirewallListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
DNSFirewall.DNSFirewallListResponsesV4PagePaginationArray = DNSFirewallListResponsesV4PagePaginationArray;
DNSFirewall.Analytics = Analytics;
DNSFirewall.ReverseDNS = ReverseDNS;
//# sourceMappingURL=dns-firewall.mjs.map