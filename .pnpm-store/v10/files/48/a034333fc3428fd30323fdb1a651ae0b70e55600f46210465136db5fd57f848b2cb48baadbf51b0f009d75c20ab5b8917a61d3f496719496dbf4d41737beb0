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
exports.EmailRouting = void 0;
const resource_1 = require("../../resource.js");
const AddressesAPI = __importStar(require("./addresses.js"));
const addresses_1 = require("./addresses.js");
const DNSAPI = __importStar(require("./dns.js"));
const dns_1 = require("./dns.js");
const RulesAPI = __importStar(require("./rules/rules.js"));
const rules_1 = require("./rules/rules.js");
class EmailRouting extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.dns = new DNSAPI.DNS(this._client);
        this.rules = new RulesAPI.Rules(this._client);
        this.addresses = new AddressesAPI.Addresses(this._client);
    }
    /**
     * Disable your Email Routing zone. Also removes additional MX records previously
     * required for Email Routing to work.
     *
     * @deprecated
     */
    disable(params, options) {
        const { zone_id, body } = params;
        return this._client.post(`/zones/${zone_id}/email/routing/disable`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Enable you Email Routing zone. Add and lock the necessary MX and SPF records.
     *
     * @deprecated
     */
    enable(params, options) {
        const { zone_id, body } = params;
        return this._client.post(`/zones/${zone_id}/email/routing/enable`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get information about the settings for your Email Routing zone.
     *
     * @example
     * ```ts
     * const settings = await client.emailRouting.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/email/routing`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.EmailRouting = EmailRouting;
EmailRouting.DNS = dns_1.DNS;
EmailRouting.DNSRecordsSinglePage = dns_1.DNSRecordsSinglePage;
EmailRouting.Rules = rules_1.Rules;
EmailRouting.EmailRoutingRulesV4PagePaginationArray = rules_1.EmailRoutingRulesV4PagePaginationArray;
EmailRouting.Addresses = addresses_1.Addresses;
EmailRouting.AddressesV4PagePaginationArray = addresses_1.AddressesV4PagePaginationArray;
//# sourceMappingURL=email-routing.js.map