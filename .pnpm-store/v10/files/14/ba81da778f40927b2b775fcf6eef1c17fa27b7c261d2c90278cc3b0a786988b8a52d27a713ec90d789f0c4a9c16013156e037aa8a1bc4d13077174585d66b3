// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as DNSAPI from "./dns.mjs";
import { DNSV4PagePagination } from "./dns.mjs";
import * as DomainHistoryAPI from "./domain-history.mjs";
import { DomainHistoryResource, } from "./domain-history.mjs";
import * as IPListsAPI from "./ip-lists.mjs";
import { IPLists, IPListsSinglePage } from "./ip-lists.mjs";
import * as IPsAPI from "./ips.mjs";
import { IPs } from "./ips.mjs";
import * as MiscategorizationsAPI from "./miscategorizations.mjs";
import { Miscategorizations, } from "./miscategorizations.mjs";
import * as SinkholesAPI from "./sinkholes.mjs";
import { Sinkholes, SinkholesSinglePage } from "./sinkholes.mjs";
import * as WhoisAPI from "./whois.mjs";
import * as ASNAPI from "./asn/asn.mjs";
import { ASN } from "./asn/asn.mjs";
import * as AttackSurfaceReportAPI from "./attack-surface-report/attack-surface-report.mjs";
import { AttackSurfaceReport } from "./attack-surface-report/attack-surface-report.mjs";
import * as DomainsAPI from "./domains/domains.mjs";
import { Domains } from "./domains/domains.mjs";
import * as IndicatorFeedsAPI from "./indicator-feeds/indicator-feeds.mjs";
import { IndicatorFeedListResponsesSinglePage, IndicatorFeeds, } from "./indicator-feeds/indicator-feeds.mjs";
export class Intel extends APIResource {
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
Intel.ASN = ASN;
Intel.DNSV4PagePagination = DNSV4PagePagination;
Intel.Domains = Domains;
Intel.DomainHistoryResource = DomainHistoryResource;
Intel.IPs = IPs;
Intel.IPLists = IPLists;
Intel.IPListsSinglePage = IPListsSinglePage;
Intel.Miscategorizations = Miscategorizations;
Intel.IndicatorFeeds = IndicatorFeeds;
Intel.IndicatorFeedListResponsesSinglePage = IndicatorFeedListResponsesSinglePage;
Intel.Sinkholes = Sinkholes;
Intel.SinkholesSinglePage = SinkholesSinglePage;
Intel.AttackSurfaceReport = AttackSurfaceReport;
//# sourceMappingURL=intel.mjs.map