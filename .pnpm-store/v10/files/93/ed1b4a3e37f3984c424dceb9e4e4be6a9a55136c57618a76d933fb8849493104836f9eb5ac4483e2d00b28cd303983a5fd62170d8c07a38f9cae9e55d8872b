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
exports.Reports = void 0;
const resource_1 = require("../../../../resource.js");
const BytimesAPI = __importStar(require("./bytimes.js"));
const bytimes_1 = require("./bytimes.js");
class Reports extends resource_1.APIResource {
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
     * const report =
     *   await client.dnsFirewall.analytics.reports.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(dnsFirewallId, params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/dns_firewall/${dnsFirewallId}/dns_analytics/report`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Reports = Reports;
Reports.Bytimes = bytimes_1.Bytimes;
//# sourceMappingURL=reports.js.map