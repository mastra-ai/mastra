"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DNSFirewallListResponsesV4PagePaginationArray = exports.DNSFirewall = void 0;
const resource_1 = require("../../resource.js");
const ReverseDNSAPI = __importStar(require("./reverse-dns.js"));
const reverse_dns_1 = require("./reverse-dns.js");
const AnalyticsAPI = __importStar(require("./analytics/analytics.js"));
const analytics_1 = require("./analytics/analytics.js");
const pagination_1 = require("../../pagination.js");
class DNSFirewall extends resource_1.APIResource {
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
exports.DNSFirewall = DNSFirewall;
class DNSFirewallListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.DNSFirewallListResponsesV4PagePaginationArray = DNSFirewallListResponsesV4PagePaginationArray;
DNSFirewall.DNSFirewallListResponsesV4PagePaginationArray = DNSFirewallListResponsesV4PagePaginationArray;
DNSFirewall.Analytics = analytics_1.Analytics;
DNSFirewall.ReverseDNS = reverse_dns_1.ReverseDNS;
//# sourceMappingURL=dns-firewall.js.map