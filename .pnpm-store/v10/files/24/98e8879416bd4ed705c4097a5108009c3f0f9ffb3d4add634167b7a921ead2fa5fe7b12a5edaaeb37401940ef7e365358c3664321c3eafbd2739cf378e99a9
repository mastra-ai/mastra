// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import { isRequestOptions } from '../../../core';
import * as Core from '../../../core';

export class Summary extends APIResource {
  /**
   * Retrieves the distribution of DNS queries to AS112 by DNSSEC (DNS Security
   * Extensions) support.
   *
   * @example
   * ```ts
   * const response = await client.radar.as112.summary.dnssec();
   * ```
   */
  dnssec(query?: SummaryDNSSECParams, options?: Core.RequestOptions): Core.APIPromise<SummaryDNSSECResponse>;
  dnssec(options?: Core.RequestOptions): Core.APIPromise<SummaryDNSSECResponse>;
  dnssec(
    query: SummaryDNSSECParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<SummaryDNSSECResponse> {
    if (isRequestOptions(query)) {
      return this.dnssec({}, query);
    }
    return (
      this._client.get('/radar/as112/summary/dnssec', { query, ...options }) as Core.APIPromise<{
        result: SummaryDNSSECResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieves the distribution of DNS queries to AS112 by EDNS (Extension Mechanisms
   * for DNS) support.
   *
   * @example
   * ```ts
   * const response = await client.radar.as112.summary.edns();
   * ```
   */
  edns(query?: SummaryEdnsParams, options?: Core.RequestOptions): Core.APIPromise<SummaryEdnsResponse>;
  edns(options?: Core.RequestOptions): Core.APIPromise<SummaryEdnsResponse>;
  edns(
    query: SummaryEdnsParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<SummaryEdnsResponse> {
    if (isRequestOptions(query)) {
      return this.edns({}, query);
    }
    return (
      this._client.get('/radar/as112/summary/edns', { query, ...options }) as Core.APIPromise<{
        result: SummaryEdnsResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieves the distribution of DNS queries to AS112 by IP version.
   *
   * @example
   * ```ts
   * const response =
   *   await client.radar.as112.summary.ipVersion();
   * ```
   */
  ipVersion(
    query?: SummaryIPVersionParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SummaryIPVersionResponse>;
  ipVersion(options?: Core.RequestOptions): Core.APIPromise<SummaryIPVersionResponse>;
  ipVersion(
    query: SummaryIPVersionParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<SummaryIPVersionResponse> {
    if (isRequestOptions(query)) {
      return this.ipVersion({}, query);
    }
    return (
      this._client.get('/radar/as112/summary/ip_version', { query, ...options }) as Core.APIPromise<{
        result: SummaryIPVersionResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieves the distribution of DNS queries to AS112 by protocol.
   *
   * @example
   * ```ts
   * const response =
   *   await client.radar.as112.summary.protocol();
   * ```
   */
  protocol(
    query?: SummaryProtocolParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SummaryProtocolResponse>;
  protocol(options?: Core.RequestOptions): Core.APIPromise<SummaryProtocolResponse>;
  protocol(
    query: SummaryProtocolParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<SummaryProtocolResponse> {
    if (isRequestOptions(query)) {
      return this.protocol({}, query);
    }
    return (
      this._client.get('/radar/as112/summary/protocol', { query, ...options }) as Core.APIPromise<{
        result: SummaryProtocolResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieves the distribution of DNS queries to AS112 by type.
   *
   * @example
   * ```ts
   * const response =
   *   await client.radar.as112.summary.queryType();
   * ```
   */
  queryType(
    query?: SummaryQueryTypeParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SummaryQueryTypeResponse>;
  queryType(options?: Core.RequestOptions): Core.APIPromise<SummaryQueryTypeResponse>;
  queryType(
    query: SummaryQueryTypeParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<SummaryQueryTypeResponse> {
    if (isRequestOptions(query)) {
      return this.queryType({}, query);
    }
    return (
      this._client.get('/radar/as112/summary/query_type', { query, ...options }) as Core.APIPromise<{
        result: SummaryQueryTypeResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieves the distribution of AS112 DNS requests classified by response code.
   *
   * @example
   * ```ts
   * const response =
   *   await client.radar.as112.summary.responseCodes();
   * ```
   */
  responseCodes(
    query?: SummaryResponseCodesParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SummaryResponseCodesResponse>;
  responseCodes(options?: Core.RequestOptions): Core.APIPromise<SummaryResponseCodesResponse>;
  responseCodes(
    query: SummaryResponseCodesParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<SummaryResponseCodesResponse> {
    if (isRequestOptions(query)) {
      return this.responseCodes({}, query);
    }
    return (
      this._client.get('/radar/as112/summary/response_codes', { query, ...options }) as Core.APIPromise<{
        result: SummaryResponseCodesResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface SummaryDNSSECResponse {
  /**
   * Metadata for the results.
   */
  meta: SummaryDNSSECResponse.Meta;

  summary_0: SummaryDNSSECResponse.Summary0;
}

export namespace SummaryDNSSECResponse {
  /**
   * Metadata for the results.
   */
  export interface Meta {
    confidenceInfo: Meta.ConfidenceInfo | null;

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

  export interface Summary0 {
    /**
     * A numeric string.
     */
    NOT_SUPPORTED: string;

    /**
     * A numeric string.
     */
    SUPPORTED: string;
  }
}

export interface SummaryEdnsResponse {
  /**
   * Metadata for the results.
   */
  meta: SummaryEdnsResponse.Meta;

  summary_0: SummaryEdnsResponse.Summary0;
}

export namespace SummaryEdnsResponse {
  /**
   * Metadata for the results.
   */
  export interface Meta {
    confidenceInfo: Meta.ConfidenceInfo | null;

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

  export interface Summary0 {
    /**
     * A numeric string.
     */
    NOT_SUPPORTED: string;

    /**
     * A numeric string.
     */
    SUPPORTED: string;
  }
}

export interface SummaryIPVersionResponse {
  /**
   * Metadata for the results.
   */
  meta: SummaryIPVersionResponse.Meta;

  summary_0: SummaryIPVersionResponse.Summary0;
}

export namespace SummaryIPVersionResponse {
  /**
   * Metadata for the results.
   */
  export interface Meta {
    confidenceInfo: Meta.ConfidenceInfo | null;

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

  export interface Summary0 {
    /**
     * A numeric string.
     */
    IPv4: string;

    /**
     * A numeric string.
     */
    IPv6: string;
  }
}

export interface SummaryProtocolResponse {
  /**
   * Metadata for the results.
   */
  meta: SummaryProtocolResponse.Meta;

  summary_0: SummaryProtocolResponse.Summary0;
}

export namespace SummaryProtocolResponse {
  /**
   * Metadata for the results.
   */
  export interface Meta {
    confidenceInfo: Meta.ConfidenceInfo | null;

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

  export interface Summary0 {
    /**
     * A numeric string.
     */
    HTTPS: string;

    /**
     * A numeric string.
     */
    TCP: string;

    /**
     * A numeric string.
     */
    TLS: string;

    /**
     * A numeric string.
     */
    UDP: string;
  }
}

export interface SummaryQueryTypeResponse {
  /**
   * Metadata for the results.
   */
  meta: SummaryQueryTypeResponse.Meta;

  summary_0: { [key: string]: string };
}

export namespace SummaryQueryTypeResponse {
  /**
   * Metadata for the results.
   */
  export interface Meta {
    confidenceInfo: Meta.ConfidenceInfo | null;

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
}

export interface SummaryResponseCodesResponse {
  /**
   * Metadata for the results.
   */
  meta: SummaryResponseCodesResponse.Meta;

  summary_0: { [key: string]: string };
}

export namespace SummaryResponseCodesResponse {
  /**
   * Metadata for the results.
   */
  export interface Meta {
    confidenceInfo: Meta.ConfidenceInfo | null;

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
}

export interface SummaryDNSSECParams {
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
}

export interface SummaryEdnsParams {
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
}

export interface SummaryIPVersionParams {
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
}

export interface SummaryProtocolParams {
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
}

export interface SummaryQueryTypeParams {
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
   * Limits the number of objects per group to the top items within the specified
   * time range. When item count exceeds the limit, extra items appear grouped under
   * an "other" category.
   */
  limitPerGroup?: number;

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
   * Filters results by DNS transport protocol.
   */
  protocol?: 'UDP' | 'TCP' | 'HTTPS' | 'TLS';

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
}

export interface SummaryResponseCodesParams {
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
   * Limits the number of objects per group to the top items within the specified
   * time range. When item count exceeds the limit, extra items appear grouped under
   * an "other" category.
   */
  limitPerGroup?: number;

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
}

export declare namespace Summary {
  export {
    type SummaryDNSSECResponse as SummaryDNSSECResponse,
    type SummaryEdnsResponse as SummaryEdnsResponse,
    type SummaryIPVersionResponse as SummaryIPVersionResponse,
    type SummaryProtocolResponse as SummaryProtocolResponse,
    type SummaryQueryTypeResponse as SummaryQueryTypeResponse,
    type SummaryResponseCodesResponse as SummaryResponseCodesResponse,
    type SummaryDNSSECParams as SummaryDNSSECParams,
    type SummaryEdnsParams as SummaryEdnsParams,
    type SummaryIPVersionParams as SummaryIPVersionParams,
    type SummaryProtocolParams as SummaryProtocolParams,
    type SummaryQueryTypeParams as SummaryQueryTypeParams,
    type SummaryResponseCodesParams as SummaryResponseCodesParams,
  };
}
