// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import { isRequestOptions } from '../../../core';
import * as Core from '../../../core';
import * as SummaryAPI from './summary';
import {
  Summary,
  SummaryCacheHitParams,
  SummaryCacheHitResponse,
  SummaryDNSSECAwareParams,
  SummaryDNSSECAwareResponse,
  SummaryDNSSECE2EParams,
  SummaryDNSSECE2EResponse,
  SummaryDNSSECParams,
  SummaryDNSSECResponse,
  SummaryIPVersionParams,
  SummaryIPVersionResponse,
  SummaryMatchingAnswerParams,
  SummaryMatchingAnswerResponse,
  SummaryProtocolParams,
  SummaryProtocolResponse,
  SummaryQueryTypeParams,
  SummaryQueryTypeResponse,
  SummaryResponseCodeParams,
  SummaryResponseCodeResponse,
  SummaryResponseTTLParams,
  SummaryResponseTTLResponse,
} from './summary';
import * as TimeseriesGroupsAPI from './timeseries-groups';
import {
  TimeseriesGroupCacheHitParams,
  TimeseriesGroupCacheHitResponse,
  TimeseriesGroupDNSSECAwareParams,
  TimeseriesGroupDNSSECAwareResponse,
  TimeseriesGroupDNSSECE2EParams,
  TimeseriesGroupDNSSECE2EResponse,
  TimeseriesGroupDNSSECParams,
  TimeseriesGroupDNSSECResponse,
  TimeseriesGroupIPVersionParams,
  TimeseriesGroupIPVersionResponse,
  TimeseriesGroupMatchingAnswerParams,
  TimeseriesGroupMatchingAnswerResponse,
  TimeseriesGroupProtocolParams,
  TimeseriesGroupProtocolResponse,
  TimeseriesGroupQueryTypeParams,
  TimeseriesGroupQueryTypeResponse,
  TimeseriesGroupResponseCodeParams,
  TimeseriesGroupResponseCodeResponse,
  TimeseriesGroupResponseTTLParams,
  TimeseriesGroupResponseTTLResponse,
  TimeseriesGroups,
} from './timeseries-groups';
import * as TopAPI from './top';
import { Top, TopAsesParams, TopAsesResponse, TopLocationsParams, TopLocationsResponse } from './top';

export class DNS extends APIResource {
  top: TopAPI.Top = new TopAPI.Top(this._client);
  summary: SummaryAPI.Summary = new SummaryAPI.Summary(this._client);
  timeseriesGroups: TimeseriesGroupsAPI.TimeseriesGroups = new TimeseriesGroupsAPI.TimeseriesGroups(
    this._client,
  );

  /**
   * Retrieves normalized query volume to the 1.1.1.1 DNS resolver over time.
   *
   * @example
   * ```ts
   * const response = await client.radar.dns.timeseries();
   * ```
   */
  timeseries(
    query?: DNSTimeseriesParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DNSTimeseriesResponse>;
  timeseries(options?: Core.RequestOptions): Core.APIPromise<DNSTimeseriesResponse>;
  timeseries(
    query: DNSTimeseriesParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<DNSTimeseriesResponse> {
    if (isRequestOptions(query)) {
      return this.timeseries({}, query);
    }
    return (
      this._client.get('/radar/dns/timeseries', { query, ...options }) as Core.APIPromise<{
        result: DNSTimeseriesResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface DNSTimeseriesResponse {
  /**
   * Metadata for the results.
   */
  meta: DNSTimeseriesResponse.Meta;

  [k: string]:
    | DNSTimeseriesResponse.unnamed_schema_ref_75bae70cf28e6bcef364b9840db3bdeb
    | DNSTimeseriesResponse.Meta
    | undefined;
}

export namespace DNSTimeseriesResponse {
  /**
   * Metadata for the results.
   */
  export interface Meta {
    /**
     * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
     * Refer to
     * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
     */
    aggInterval: 'FIFTEEN_MINUTES' | 'ONE_HOUR' | 'ONE_DAY' | 'ONE_WEEK' | 'ONE_MONTH';

    confidenceInfo: Meta.ConfidenceInfo;

    dateRange: Array<Meta.DateRange>;

    /**
     * Timestamp of the last dataset update.
     */
    lastUpdated: string;

    /**
     * Normalization method applied to the results. Refer to
     * [Normalization methods](https://developers.cloudflare.com/radar/concepts/normalization/).
     */
    normalization:
      | 'PERCENTAGE'
      | 'MIN0_MAX'
      | 'MIN_MAX'
      | 'RAW_VALUES'
      | 'PERCENTAGE_CHANGE'
      | 'ROLLING_AVERAGE'
      | 'OVERLAPPED_PERCENTAGE'
      | 'RATIO';

    /**
     * Measurement units for the results.
     */
    units: Array<Meta.Unit>;
  }

  export namespace Meta {
    export interface ConfidenceInfo {
      annotations: Array<ConfidenceInfo.Annotation>;

      /**
       * Provides an indication of how much confidence Cloudflare has in the data.
       */
      level: number;
    }

    export namespace ConfidenceInfo {
      /**
       * Annotation associated with the result (e.g. outage or other type of event).
       */
      export interface Annotation {
        dataSource: string;

        description: string;

        endDate: string;

        eventType: string;

        /**
         * Whether event is a single point in time or a time range.
         */
        isInstantaneous: boolean;

        linkedUrl: string;

        startDate: string;
      }
    }

    export interface DateRange {
      /**
       * Adjusted end of date range.
       */
      endTime: string;

      /**
       * Adjusted start of date range.
       */
      startTime: string;
    }

    export interface Unit {
      name: string;

      value: string;
    }
  }

  export interface unnamed_schema_ref_75bae70cf28e6bcef364b9840db3bdeb {
    timestamps: Array<string>;

    values: Array<string>;
  }
}

export interface DNSTimeseriesParams {
  /**
   * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
   * Refer to
   * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
   */
  aggInterval?: '15m' | '1h' | '1d' | '1w';

  /**
   * Filters results by Autonomous System. Specify one or more Autonomous System
   * Numbers (ASNs) as a comma-separated list. Prefix with `-` to exclude ASNs from
   * results. For example, `-174, 3356` excludes results from AS174, but includes
   * results from AS3356.
   */
  asn?: Array<string>;

  /**
   * Filters results by continent. Specify a comma-separated list of alpha-2 codes.
   * Prefix with `-` to exclude continents from results. For example, `-EU,NA`
   * excludes results from EU, but includes results from NA.
   */
  continent?: Array<string>;

  /**
   * End of the date range (inclusive).
   */
  dateEnd?: Array<string>;

  /**
   * Filters results by date range. For example, use `7d` and `7dcontrol` to compare
   * this week with the previous week. Use this parameter or set specific start and
   * end dates (`dateStart` and `dateEnd` parameters).
   */
  dateRange?: Array<string>;

  /**
   * Start of the date range.
   */
  dateStart?: Array<string>;

  /**
   * Format in which results will be returned.
   */
  format?: 'JSON' | 'CSV';

  /**
   * Filters results by location. Specify a comma-separated list of alpha-2 codes.
   * Prefix with `-` to exclude locations from results. For example, `-US,PT`
   * excludes results from the US, but includes results from PT.
   */
  location?: Array<string>;

  /**
   * Array of names used to label the series in the response.
   */
  name?: Array<string>;

  /**
   * Specifies whether the response includes empty DNS responses (NODATA).
   */
  nodata?: boolean;

  /**
   * Filters results by DNS transport protocol.
   */
  protocol?: 'UDP' | 'TCP' | 'HTTPS' | 'TLS';

  /**
   * Filters results by DNS query type.
   */
  queryType?:
    | 'A'
    | 'AAAA'
    | 'A6'
    | 'AFSDB'
    | 'ANY'
    | 'APL'
    | 'ATMA'
    | 'AXFR'
    | 'CAA'
    | 'CDNSKEY'
    | 'CDS'
    | 'CERT'
    | 'CNAME'
    | 'CSYNC'
    | 'DHCID'
    | 'DLV'
    | 'DNAME'
    | 'DNSKEY'
    | 'DOA'
    | 'DS'
    | 'EID'
    | 'EUI48'
    | 'EUI64'
    | 'GPOS'
    | 'GID'
    | 'HINFO'
    | 'HIP'
    | 'HTTPS'
    | 'IPSECKEY'
    | 'ISDN'
    | 'IXFR'
    | 'KEY'
    | 'KX'
    | 'L32'
    | 'L64'
    | 'LOC'
    | 'LP'
    | 'MAILA'
    | 'MAILB'
    | 'MB'
    | 'MD'
    | 'MF'
    | 'MG'
    | 'MINFO'
    | 'MR'
    | 'MX'
    | 'NAPTR'
    | 'NB'
    | 'NBSTAT'
    | 'NID'
    | 'NIMLOC'
    | 'NINFO'
    | 'NS'
    | 'NSAP'
    | 'NSEC'
    | 'NSEC3'
    | 'NSEC3PARAM'
    | 'NULL'
    | 'NXT'
    | 'OPENPGPKEY'
    | 'OPT'
    | 'PTR'
    | 'PX'
    | 'RKEY'
    | 'RP'
    | 'RRSIG'
    | 'RT'
    | 'SIG'
    | 'SINK'
    | 'SMIMEA'
    | 'SOA'
    | 'SPF'
    | 'SRV'
    | 'SSHFP'
    | 'SVCB'
    | 'TA'
    | 'TALINK'
    | 'TKEY'
    | 'TLSA'
    | 'TSIG'
    | 'TXT'
    | 'UINFO'
    | 'UID'
    | 'UNSPEC'
    | 'URI'
    | 'WKS'
    | 'X25'
    | 'ZONEMD'
    | null;

  /**
   * Filters results by DNS response code.
   */
  responseCode?:
    | 'NOERROR'
    | 'FORMERR'
    | 'SERVFAIL'
    | 'NXDOMAIN'
    | 'NOTIMP'
    | 'REFUSED'
    | 'YXDOMAIN'
    | 'YXRRSET'
    | 'NXRRSET'
    | 'NOTAUTH'
    | 'NOTZONE'
    | 'BADSIG'
    | 'BADKEY'
    | 'BADTIME'
    | 'BADMODE'
    | 'BADNAME'
    | 'BADALG'
    | 'BADTRUNC'
    | 'BADCOOKIE';

  /**
   * Filters results by country code top-level domain (ccTLD).
   */
  tld?: Array<string>;
}

DNS.Top = Top;
DNS.Summary = Summary;
DNS.TimeseriesGroups = TimeseriesGroups;

export declare namespace DNS {
  export {
    type DNSTimeseriesResponse as DNSTimeseriesResponse,
    type DNSTimeseriesParams as DNSTimeseriesParams,
  };

  export {
    Top as Top,
    type TopAsesResponse as TopAsesResponse,
    type TopLocationsResponse as TopLocationsResponse,
    type TopAsesParams as TopAsesParams,
    type TopLocationsParams as TopLocationsParams,
  };

  export {
    Summary as Summary,
    type SummaryCacheHitResponse as SummaryCacheHitResponse,
    type SummaryDNSSECResponse as SummaryDNSSECResponse,
    type SummaryDNSSECAwareResponse as SummaryDNSSECAwareResponse,
    type SummaryDNSSECE2EResponse as SummaryDNSSECE2EResponse,
    type SummaryIPVersionResponse as SummaryIPVersionResponse,
    type SummaryMatchingAnswerResponse as SummaryMatchingAnswerResponse,
    type SummaryProtocolResponse as SummaryProtocolResponse,
    type SummaryQueryTypeResponse as SummaryQueryTypeResponse,
    type SummaryResponseCodeResponse as SummaryResponseCodeResponse,
    type SummaryResponseTTLResponse as SummaryResponseTTLResponse,
    type SummaryCacheHitParams as SummaryCacheHitParams,
    type SummaryDNSSECParams as SummaryDNSSECParams,
    type SummaryDNSSECAwareParams as SummaryDNSSECAwareParams,
    type SummaryDNSSECE2EParams as SummaryDNSSECE2EParams,
    type SummaryIPVersionParams as SummaryIPVersionParams,
    type SummaryMatchingAnswerParams as SummaryMatchingAnswerParams,
    type SummaryProtocolParams as SummaryProtocolParams,
    type SummaryQueryTypeParams as SummaryQueryTypeParams,
    type SummaryResponseCodeParams as SummaryResponseCodeParams,
    type SummaryResponseTTLParams as SummaryResponseTTLParams,
  };

  export {
    TimeseriesGroups as TimeseriesGroups,
    type TimeseriesGroupCacheHitResponse as TimeseriesGroupCacheHitResponse,
    type TimeseriesGroupDNSSECResponse as TimeseriesGroupDNSSECResponse,
    type TimeseriesGroupDNSSECAwareResponse as TimeseriesGroupDNSSECAwareResponse,
    type TimeseriesGroupDNSSECE2EResponse as TimeseriesGroupDNSSECE2EResponse,
    type TimeseriesGroupIPVersionResponse as TimeseriesGroupIPVersionResponse,
    type TimeseriesGroupMatchingAnswerResponse as TimeseriesGroupMatchingAnswerResponse,
    type TimeseriesGroupProtocolResponse as TimeseriesGroupProtocolResponse,
    type TimeseriesGroupQueryTypeResponse as TimeseriesGroupQueryTypeResponse,
    type TimeseriesGroupResponseCodeResponse as TimeseriesGroupResponseCodeResponse,
    type TimeseriesGroupResponseTTLResponse as TimeseriesGroupResponseTTLResponse,
    type TimeseriesGroupCacheHitParams as TimeseriesGroupCacheHitParams,
    type TimeseriesGroupDNSSECParams as TimeseriesGroupDNSSECParams,
    type TimeseriesGroupDNSSECAwareParams as TimeseriesGroupDNSSECAwareParams,
    type TimeseriesGroupDNSSECE2EParams as TimeseriesGroupDNSSECE2EParams,
    type TimeseriesGroupIPVersionParams as TimeseriesGroupIPVersionParams,
    type TimeseriesGroupMatchingAnswerParams as TimeseriesGroupMatchingAnswerParams,
    type TimeseriesGroupProtocolParams as TimeseriesGroupProtocolParams,
    type TimeseriesGroupQueryTypeParams as TimeseriesGroupQueryTypeParams,
    type TimeseriesGroupResponseCodeParams as TimeseriesGroupResponseCodeParams,
    type TimeseriesGroupResponseTTLParams as TimeseriesGroupResponseTTLParams,
  };
}
