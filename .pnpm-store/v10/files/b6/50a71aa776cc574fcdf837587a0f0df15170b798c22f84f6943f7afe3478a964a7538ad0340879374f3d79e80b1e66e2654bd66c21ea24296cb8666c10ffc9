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
exports.Intel = void 0;
const resource_1 = require("../../resource.js");
const DNSAPI = __importStar(require("./dns.js"));
const dns_1 = require("./dns.js");
const DomainHistoryAPI = __importStar(require("./domain-history.js"));
const domain_history_1 = require("./domain-history.js");
const IPListsAPI = __importStar(require("./ip-lists.js"));
const ip_lists_1 = require("./ip-lists.js");
const IPsAPI = __importStar(require("./ips.js"));
const ips_1 = require("./ips.js");
const MiscategorizationsAPI = __importStar(require("./miscategorizations.js"));
const miscategorizations_1 = require("./miscategorizations.js");
const SinkholesAPI = __importStar(require("./sinkholes.js"));
const sinkholes_1 = require("./sinkholes.js");
const WhoisAPI = __importStar(require("./whois.js"));
const ASNAPI = __importStar(require("./asn/asn.js"));
const asn_1 = require("./asn/asn.js");
const AttackSurfaceReportAPI = __importStar(require("./attack-surface-report/attack-surface-report.js"));
const attack_surface_report_1 = require("./attack-surface-report/attack-surface-report.js");
const DomainsAPI = __importStar(require("./domains/domains.js"));
const domains_1 = require("./domains/domains.js");
const IndicatorFeedsAPI = __importStar(require("./indicator-feeds/indicator-feeds.js"));
const indicator_feeds_1 = require("./indicator-feeds/indicator-feeds.js");
class Intel extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.asn = new ASNAPI.ASN(this._client);
        this.dns = new DNSAPI.DNS(this._client);
        this.domains = new DomainsAPI.Domains(this._client);
        this.domainHistory = new DomainHistoryAPI.DomainHistoryResource(this._client);
        this.ips = new IPsAPI.IPs(this._client);
        this.ipLists = new IPListsAPI.IPLists(this._client);
        this.miscategorizations = new MiscategorizationsAPI.Miscategorizations(this._client);
        this.whois = new WhoisAPI.Whois(this._client);
        this.indicatorFeeds = new IndicatorFeedsAPI.IndicatorFeeds(this._client);
        this.sinkholes = new SinkholesAPI.Sinkholes(this._client);
        this.attackSurfaceReport = new AttackSurfaceReportAPI.AttackSurfaceReport(this._client);
    }
}
exports.Intel = Intel;
Intel.ASN = asn_1.ASN;
Intel.DNSV4PagePagination = dns_1.DNSV4PagePagination;
Intel.Domains = domains_1.Domains;
Intel.DomainHistoryResource = domain_history_1.DomainHistoryResource;
Intel.IPs = ips_1.IPs;
Intel.IPLists = ip_lists_1.IPLists;
Intel.IPListsSinglePage = ip_lists_1.IPListsSinglePage;
Intel.Miscategorizations = miscategorizations_1.Miscategorizations;
Intel.IndicatorFeeds = indicator_feeds_1.IndicatorFeeds;
Intel.IndicatorFeedListResponsesSinglePage = indicator_feeds_1.IndicatorFeedListResponsesSinglePage;
Intel.Sinkholes = sinkholes_1.Sinkholes;
Intel.SinkholesSinglePage = sinkholes_1.SinkholesSinglePage;
Intel.AttackSurfaceReport = attack_surface_report_1.AttackSurfaceReport;
//# sourceMappingURL=intel.js.map