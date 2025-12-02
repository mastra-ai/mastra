// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as DNSAPI from './dns';
import { DNS, DNSListParams, DNSV4PagePagination } from './dns';
import * as DomainHistoryAPI from './domain-history';
import {
  DomainHistory,
  DomainHistoryGetParams,
  DomainHistoryGetResponse,
  DomainHistoryResource,
} from './domain-history';
import * as IPListsAPI from './ip-lists';
import { IPList, IPListGetParams, IPLists, IPListsSinglePage } from './ip-lists';
import * as IPsAPI from './ips';
import { IP, IPGetParams, IPGetResponse, IPs } from './ips';
import * as MiscategorizationsAPI from './miscategorizations';
import {
  MiscategorizationCreateParams,
  MiscategorizationCreateResponse,
  Miscategorizations,
} from './miscategorizations';
import * as SinkholesAPI from './sinkholes';
import { Sinkhole, SinkholeListParams, Sinkholes, SinkholesSinglePage } from './sinkholes';
import * as WhoisAPI from './whois';
import { Whois, WhoisGetParams, WhoisGetResponse } from './whois';
import * as ASNAPI from './asn/asn';
import { ASN, ASNGetParams } from './asn/asn';
import * as AttackSurfaceReportAPI from './attack-surface-report/attack-surface-report';
import { AttackSurfaceReport } from './attack-surface-report/attack-surface-report';
import * as DomainsAPI from './domains/domains';
import { Domain, DomainGetParams, Domains } from './domains/domains';
import * as IndicatorFeedsAPI from './indicator-feeds/indicator-feeds';
import {
  IndicatorFeedCreateParams,
  IndicatorFeedCreateResponse,
  IndicatorFeedDataParams,
  IndicatorFeedDataResponse,
  IndicatorFeedGetParams,
  IndicatorFeedGetResponse,
  IndicatorFeedListParams,
  IndicatorFeedListResponse,
  IndicatorFeedListResponsesSinglePage,
  IndicatorFeedUpdateParams,
  IndicatorFeedUpdateResponse,
  IndicatorFeeds,
} from './indicator-feeds/indicator-feeds';

export class Intel extends APIResource {
  asn: ASNAPI.ASN = new ASNAPI.ASN(this._client);
  dns: DNSAPI.DNS = new DNSAPI.DNS(this._client);
  domains: DomainsAPI.Domains = new DomainsAPI.Domains(this._client);
  domainHistory: DomainHistoryAPI.DomainHistoryResource = new DomainHistoryAPI.DomainHistoryResource(
    this._client,
  );
  ips: IPsAPI.IPs = new IPsAPI.IPs(this._client);
  ipLists: IPListsAPI.IPLists = new IPListsAPI.IPLists(this._client);
  miscategorizations: MiscategorizationsAPI.Miscategorizations = new MiscategorizationsAPI.Miscategorizations(
    this._client,
  );
  whois: WhoisAPI.Whois = new WhoisAPI.Whois(this._client);
  indicatorFeeds: IndicatorFeedsAPI.IndicatorFeeds = new IndicatorFeedsAPI.IndicatorFeeds(this._client);
  sinkholes: SinkholesAPI.Sinkholes = new SinkholesAPI.Sinkholes(this._client);
  attackSurfaceReport: AttackSurfaceReportAPI.AttackSurfaceReport =
    new AttackSurfaceReportAPI.AttackSurfaceReport(this._client);
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

export declare namespace Intel {
  export { ASN as ASN, type ASNGetParams as ASNGetParams };

  export { type DNS as DNS, DNSV4PagePagination as DNSV4PagePagination, type DNSListParams as DNSListParams };

  export { Domains as Domains, type Domain as Domain, type DomainGetParams as DomainGetParams };

  export {
    DomainHistoryResource as DomainHistoryResource,
    type DomainHistory as DomainHistory,
    type DomainHistoryGetResponse as DomainHistoryGetResponse,
    type DomainHistoryGetParams as DomainHistoryGetParams,
  };

  export { IPs as IPs, type IP as IP, type IPGetResponse as IPGetResponse, type IPGetParams as IPGetParams };

  export {
    IPLists as IPLists,
    type IPList as IPList,
    IPListsSinglePage as IPListsSinglePage,
    type IPListGetParams as IPListGetParams,
  };

  export {
    Miscategorizations as Miscategorizations,
    type MiscategorizationCreateResponse as MiscategorizationCreateResponse,
    type MiscategorizationCreateParams as MiscategorizationCreateParams,
  };

  export {
    type Whois as Whois,
    type WhoisGetResponse as WhoisGetResponse,
    type WhoisGetParams as WhoisGetParams,
  };

  export {
    IndicatorFeeds as IndicatorFeeds,
    type IndicatorFeedCreateResponse as IndicatorFeedCreateResponse,
    type IndicatorFeedUpdateResponse as IndicatorFeedUpdateResponse,
    type IndicatorFeedListResponse as IndicatorFeedListResponse,
    type IndicatorFeedDataResponse as IndicatorFeedDataResponse,
    type IndicatorFeedGetResponse as IndicatorFeedGetResponse,
    IndicatorFeedListResponsesSinglePage as IndicatorFeedListResponsesSinglePage,
    type IndicatorFeedCreateParams as IndicatorFeedCreateParams,
    type IndicatorFeedUpdateParams as IndicatorFeedUpdateParams,
    type IndicatorFeedListParams as IndicatorFeedListParams,
    type IndicatorFeedDataParams as IndicatorFeedDataParams,
    type IndicatorFeedGetParams as IndicatorFeedGetParams,
  };

  export {
    Sinkholes as Sinkholes,
    type Sinkhole as Sinkhole,
    SinkholesSinglePage as SinkholesSinglePage,
    type SinkholeListParams as SinkholeListParams,
  };

  export { AttackSurfaceReport as AttackSurfaceReport };
}
