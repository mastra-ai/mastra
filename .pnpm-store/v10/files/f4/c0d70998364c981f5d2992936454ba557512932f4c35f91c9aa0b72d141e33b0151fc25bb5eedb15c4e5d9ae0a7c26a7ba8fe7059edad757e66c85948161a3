// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class ReverseDNS extends APIResource {
    /**
     * Update reverse DNS configuration (PTR records) for a DNS Firewall cluster
     *
     * @example
     * ```ts
     * const response = await client.dnsFirewall.reverseDNS.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(dnsFirewallId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/dns_firewall/${dnsFirewallId}/reverse_dns`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Show reverse DNS configuration (PTR records) for a DNS Firewall cluster
     *
     * @example
     * ```ts
     * const reverseDNS = await client.dnsFirewall.reverseDNS.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(dnsFirewallId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dns_firewall/${dnsFirewallId}/reverse_dns`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=reverse-dns.mjs.map