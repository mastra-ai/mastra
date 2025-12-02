// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { type Response as FetchResponse } from '../../_shims/index';

export class Scans extends APIResource {
  /**
   * Submit a URL to scan. Check limits at
   * https://developers.cloudflare.com/security-center/investigate/scan-limits/.
   *
   * @example
   * ```ts
   * const scan = await client.urlScanner.scans.create({
   *   account_id: 'account_id',
   *   url: 'https://www.example.com',
   * });
   * ```
   */
  create(params: ScanCreateParams, options?: Core.RequestOptions): Core.APIPromise<ScanCreateResponse> {
    const { account_id, ...body } = params;
    return this._client.post(`/accounts/${account_id}/urlscanner/v2/scan`, { body, ...options });
  }

  /**
   * Use a subset of ElasticSearch Query syntax to filter scans. Some example
   * queries:<br/> <br/>- 'path:"/bundles/jquery.js"': Searches for scans who
   * requested resources with the given path.<br/>- 'page.asn:AS24940 AND hash:xxx':
   * Websites hosted in AS24940 where a resource with the given hash was
   * downloaded.<br/>- 'page.domain:microsoft\* AND verdicts.malicious:true AND NOT
   * page.domain:microsoft.com': malicious scans whose hostname starts with
   * "microsoft".<br/>- 'apikey:me AND date:[2025-01 TO 2025-02]': my scans from 2025
   * January to 2025 February.
   *
   * @example
   * ```ts
   * const scans = await client.urlScanner.scans.list({
   *   account_id: 'account_id',
   * });
   * ```
   */
  list(params: ScanListParams, options?: Core.RequestOptions): Core.APIPromise<ScanListResponse> {
    const { account_id, ...query } = params;
    return this._client.get(`/accounts/${account_id}/urlscanner/v2/search`, { query, ...options });
  }

  /**
   * Submit URLs to scan. Check limits at
   * https://developers.cloudflare.com/security-center/investigate/scan-limits/ and
   * take into account scans submitted in bulk have lower priority and may take
   * longer to finish.
   *
   * @example
   * ```ts
   * const response = await client.urlScanner.scans.bulkCreate({
   *   account_id: 'account_id',
   * });
   * ```
   */
  bulkCreate(
    params: ScanBulkCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ScanBulkCreateResponse> {
    const { account_id, body } = params ?? {};
    return this._client.post(`/accounts/${account_id}/urlscanner/v2/bulk`, { body: body, ...options });
  }

  /**
   * Returns a plain text response, with the scan's DOM content as rendered by
   * Chrome.
   *
   * @example
   * ```ts
   * const response = await client.urlScanner.scans.dom(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  dom(scanId: string, params: ScanDOMParams, options?: Core.RequestOptions): Core.APIPromise<string> {
    const { account_id } = params;
    return this._client.get(`/accounts/${account_id}/urlscanner/v2/dom/${scanId}`, {
      ...options,
      headers: { Accept: 'text/plain', ...options?.headers },
    });
  }

  /**
   * Get URL scan by uuid
   *
   * @example
   * ```ts
   * const scan = await client.urlScanner.scans.get(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  get(
    scanId: string,
    params: ScanGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ScanGetResponse> {
    const { account_id } = params;
    return this._client.get(`/accounts/${account_id}/urlscanner/v2/result/${scanId}`, options);
  }

  /**
   * Get a URL scan's HAR file. See HAR spec at
   * http://www.softwareishard.com/blog/har-12-spec/.
   *
   * @example
   * ```ts
   * const response = await client.urlScanner.scans.har(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  har(
    scanId: string,
    params: ScanHARParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ScanHARResponse> {
    const { account_id } = params;
    return this._client.get(`/accounts/${account_id}/urlscanner/v2/har/${scanId}`, options);
  }

  /**
   * Get scan's screenshot by resolution (desktop/mobile/tablet).
   *
   * @example
   * ```ts
   * const response = await client.urlScanner.scans.screenshot(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { account_id: 'account_id' },
   * );
   *
   * const content = await response.blob();
   * console.log(content);
   * ```
   */
  screenshot(
    scanId: string,
    params: ScanScreenshotParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<FetchResponse> {
    const { account_id, ...query } = params;
    return this._client.get(`/accounts/${account_id}/urlscanner/v2/screenshots/${scanId}.png`, {
      query,
      ...options,
      headers: { Accept: 'image/png', ...options?.headers },
      __binaryResponse: true,
    });
  }
}

export interface ScanCreateResponse {
  /**
   * URL to api report.
   */
  api: string;

  message: string;

  /**
   * Public URL to report.
   */
  result: string;

  /**
   * Canonical form of submitted URL. Use this if you want to later search by URL.
   */
  url: string;

  /**
   * Scan ID.
   */
  uuid: string;

  /**
   * Submitted visibility status.
   */
  visibility: 'public' | 'unlisted';

  options?: ScanCreateResponse.Options;
}

export namespace ScanCreateResponse {
  export interface Options {
    useragent?: string;
  }
}

export interface ScanListResponse {
  results: Array<ScanListResponse.Result>;
}

export namespace ScanListResponse {
  export interface Result {
    _id: string;

    page: Result.Page;

    result: string;

    stats: Result.Stats;

    task: Result.Task;

    verdicts: Result.Verdicts;
  }

  export namespace Result {
    export interface Page {
      asn: string;

      country: string;

      ip: string;

      url: string;
    }

    export interface Stats {
      dataLength: number;

      requests: number;

      uniqCountries: number;

      uniqIPs: number;
    }

    export interface Task {
      time: string;

      url: string;

      uuid: string;

      visibility: string;
    }

    export interface Verdicts {
      malicious: boolean;
    }
  }
}

export type ScanBulkCreateResponse = Array<ScanBulkCreateResponse.ScanBulkCreateResponseItem>;

export namespace ScanBulkCreateResponse {
  export interface ScanBulkCreateResponseItem {
    /**
     * URL to api report.
     */
    api: string;

    /**
     * URL to report.
     */
    result: string;

    /**
     * Submitted URL
     */
    url: string;

    /**
     * Scan ID.
     */
    uuid: string;

    /**
     * Submitted visibility status.
     */
    visibility: 'public' | 'unlisted';

    options?: ScanBulkCreateResponseItem.Options;
  }

  export namespace ScanBulkCreateResponseItem {
    export interface Options {
      useragent?: string;
    }
  }
}

/**
 * HTML of webpage.
 */
export type ScanDOMResponse = string;

export interface ScanGetResponse {
  data: ScanGetResponse.Data;

  lists: ScanGetResponse.Lists;

  meta: ScanGetResponse.Meta;

  page: ScanGetResponse.Page;

  scanner: ScanGetResponse.Scanner;

  stats: ScanGetResponse.Stats;

  task: ScanGetResponse.Task;

  verdicts: ScanGetResponse.Verdicts;
}

export namespace ScanGetResponse {
  export interface Data {
    console: Array<Data.Console>;

    cookies: Array<Data.Cookie>;

    globals: Array<Data.Global>;

    links: Array<Data.Link>;

    performance: Array<Data.Performance>;

    requests: Array<Data.Request>;
  }

  export namespace Data {
    export interface Console {
      message: Console.Message;
    }

    export namespace Console {
      export interface Message {
        level: string;

        source: string;

        text: string;

        url: string;
      }
    }

    export interface Cookie {
      domain: string;

      expires: number;

      httpOnly: boolean;

      name: string;

      path: string;

      priority: string;

      sameParty: boolean;

      secure: boolean;

      session: boolean;

      size: number;

      sourcePort: number;

      sourceScheme: string;

      value: string;
    }

    export interface Global {
      prop: string;

      type: string;
    }

    export interface Link {
      href: string;

      text: string;
    }

    export interface Performance {
      duration: number;

      entryType: string;

      name: string;

      startTime: number;
    }

    export interface Request {
      request: Request.Request;

      response: Request.Response;

      requests?: Array<Request.RequestItem>;
    }

    export namespace Request {
      export interface Request {
        documentURL: string;

        hasUserGesture: boolean;

        initiator: Request.Initiator;

        redirectHasExtraInfo: boolean;

        request: Request.Request;

        requestId: string;

        type: string;

        wallTime: number;

        frameId?: string;

        loaderId?: string;

        primaryRequest?: boolean;

        redirectResponse?: Request.RedirectResponse;
      }

      export namespace Request {
        export interface Initiator {
          host: string;

          type: string;

          url: string;
        }

        export interface Request {
          initialPriority: string;

          isSameSite: boolean;

          method: string;

          mixedContentType: string;

          referrerPolicy: string;

          url: string;

          headers?: unknown;
        }

        export interface RedirectResponse {
          charset: string;

          mimeType: string;

          protocol: string;

          remoteIPAddress: string;

          remotePort: number;

          securityHeaders: Array<RedirectResponse.SecurityHeader>;

          securityState: string;

          status: number;

          statusText: string;

          url: string;

          headers?: unknown;
        }

        export namespace RedirectResponse {
          export interface SecurityHeader {
            name: string;

            value: string;
          }
        }
      }

      export interface Response {
        asn: Response.ASN;

        dataLength: number;

        encodedDataLength: number;

        geoip: Response.Geoip;

        hasExtraInfo: boolean;

        requestId: string;

        response: Response.Response;

        size: number;

        type: string;

        contentAvailable?: boolean;

        hash?: string;
      }

      export namespace Response {
        export interface ASN {
          asn: string;

          country: string;

          description: string;

          ip: string;

          name: string;

          org: string;
        }

        export interface Geoip {
          city: string;

          country: string;

          country_name: string;

          geonameId: string;

          ll: Array<number>;

          region: string;
        }

        export interface Response {
          charset: string;

          mimeType: string;

          protocol: string;

          remoteIPAddress: string;

          remotePort: number;

          securityDetails: Response.SecurityDetails;

          securityHeaders: Array<Response.SecurityHeader>;

          securityState: string;

          status: number;

          statusText: string;

          url: string;

          headers?: unknown;
        }

        export namespace Response {
          export interface SecurityDetails {
            certificateId: number;

            certificateTransparencyCompliance: string;

            cipher: string;

            encryptedClientHello: boolean;

            issuer: string;

            keyExchange: string;

            keyExchangeGroup: string;

            protocol: string;

            sanList: Array<string>;

            serverSignatureAlgorithm: number;

            subjectName: string;

            validFrom: number;

            validTo: number;
          }

          export interface SecurityHeader {
            name: string;

            value: string;
          }
        }
      }

      export interface RequestItem {
        documentURL: string;

        frameId: string;

        hasUserGesture: boolean;

        initiator: RequestItem.Initiator;

        loaderId: string;

        redirectHasExtraInfo: boolean;

        request: RequestItem.Request;

        requestId: string;

        type: string;

        wallTime: number;
      }

      export namespace RequestItem {
        export interface Initiator {
          type: string;
        }

        export interface Request {
          headers: Request.Headers;

          initialPriority: string;

          isSameSite: boolean;

          method: string;

          mixedContentType: string;

          referrerPolicy: string;

          url: string;
        }

        export namespace Request {
          export interface Headers {
            name: string;
          }
        }
      }
    }
  }

  export interface Lists {
    asns: Array<string>;

    certificates: Array<Lists.Certificate>;

    continents: Array<string>;

    countries: Array<string>;

    domains: Array<string>;

    hashes: Array<string>;

    ips: Array<string>;

    linkDomains: Array<string>;

    servers: Array<string>;

    urls: Array<string>;
  }

  export namespace Lists {
    export interface Certificate {
      issuer: string;

      subjectName: string;

      validFrom: number;

      validTo: number;
    }
  }

  export interface Meta {
    processors: Meta.Processors;
  }

  export namespace Meta {
    export interface Processors {
      asn: Processors.ASN;

      dns: Processors.DNS;

      domainCategories: Processors.DomainCategories;

      geoip: Processors.Geoip;

      phishing: Processors.Phishing;

      radarRank: Processors.RadarRank;

      wappa: Processors.Wappa;

      urlCategories?: Processors.URLCategories;
    }

    export namespace Processors {
      export interface ASN {
        data: Array<ASN.Data>;
      }

      export namespace ASN {
        export interface Data {
          asn: string;

          country: string;

          description: string;

          ip: string;

          name: string;
        }
      }

      export interface DNS {
        data: Array<DNS.Data>;
      }

      export namespace DNS {
        export interface Data {
          address: string;

          dnssec_valid: boolean;

          name: string;

          type: string;
        }
      }

      export interface DomainCategories {
        data: Array<DomainCategories.Data>;
      }

      export namespace DomainCategories {
        export interface Data {
          inherited: unknown;

          isPrimary: boolean;

          name: string;
        }
      }

      export interface Geoip {
        data: Array<Geoip.Data>;
      }

      export namespace Geoip {
        export interface Data {
          geoip: Data.Geoip;

          ip: string;
        }

        export namespace Data {
          export interface Geoip {
            city: string;

            country: string;

            country_name: string;

            ll: Array<number>;

            region: string;
          }
        }
      }

      export interface Phishing {
        data: Array<string>;
      }

      export interface RadarRank {
        data: Array<RadarRank.Data>;
      }

      export namespace RadarRank {
        export interface Data {
          bucket: string;

          hostname: string;

          rank?: number;
        }
      }

      export interface Wappa {
        data: Array<Wappa.Data>;
      }

      export namespace Wappa {
        export interface Data {
          app: string;

          categories: Array<Data.Category>;

          confidence: Array<Data.Confidence>;

          confidenceTotal: number;

          icon: string;

          website: string;
        }

        export namespace Data {
          export interface Category {
            name: string;

            priority: number;
          }

          export interface Confidence {
            confidence: number;

            name: string;

            pattern: string;

            patternType: string;
          }
        }
      }

      export interface URLCategories {
        data: Array<URLCategories.Data>;
      }

      export namespace URLCategories {
        export interface Data {
          content: Array<Data.Content>;

          inherited: Data.Inherited;

          name: string;

          risks: Array<Data.Risk>;
        }

        export namespace Data {
          export interface Content {
            id: number;

            name: string;

            super_category_id: number;
          }

          export interface Inherited {
            content: Array<Inherited.Content>;

            from: string;

            risks: Array<Inherited.Risk>;
          }

          export namespace Inherited {
            export interface Content {
              id: number;

              name: string;

              super_category_id: number;
            }

            export interface Risk {
              id: number;

              name: string;

              super_category_id: number;
            }
          }

          export interface Risk {
            id: number;

            name: string;

            super_category_id: number;
          }
        }
      }
    }
  }

  export interface Page {
    apexDomain: string;

    asn: string;

    asnname: string;

    city: string;

    country: string;

    domain: string;

    ip: string;

    mimeType: string;

    server: string;

    status: string;

    title: string;

    tlsAgeDays: number;

    tlsIssuer: string;

    tlsValidDays: number;

    tlsValidFrom: string;

    url: string;

    screenshot?: Page.Screenshot;
  }

  export namespace Page {
    export interface Screenshot {
      dhash: string;

      mm3Hash: number;

      name: string;

      phash: string;
    }
  }

  export interface Scanner {
    colo: string;

    country: string;
  }

  export interface Stats {
    domainStats: Array<Stats.DomainStat>;

    ipStats: Array<Stats.IPStat>;

    IPv6Percentage: number;

    malicious: number;

    protocolStats: Array<Stats.ProtocolStat>;

    resourceStats: Array<Stats.ResourceStat>;

    securePercentage: number;

    secureRequests: number;

    serverStats: Array<Stats.ServerStat>;

    tlsStats: Array<Stats.TLSStat>;

    totalLinks: number;

    uniqASNs: number;

    uniqCountries: number;
  }

  export namespace Stats {
    export interface DomainStat {
      count: number;

      countries: Array<string>;

      domain: string;

      encodedSize: number;

      index: number;

      initiators: Array<string>;

      ips: Array<string>;

      redirects: number;

      size: number;
    }

    export interface IPStat {
      asn: IPStat.ASN;

      countries: Array<string>;

      domains: Array<string>;

      encodedSize: number;

      geoip: IPStat.Geoip;

      index: number;

      ip: string;

      ipv6: boolean;

      redirects: number;

      requests: number;

      size: number;

      count?: number;
    }

    export namespace IPStat {
      export interface ASN {
        asn: string;

        country: string;

        description: string;

        ip: string;

        name: string;

        org: string;
      }

      export interface Geoip {
        city: string;

        country: string;

        country_name: string;

        ll: Array<number>;

        region: string;
      }
    }

    export interface ProtocolStat {
      count: number;

      countries: Array<string>;

      encodedSize: number;

      ips: Array<string>;

      protocol: string;

      size: number;
    }

    export interface ResourceStat {
      compression: number;

      count: number;

      countries: Array<string>;

      encodedSize: number;

      ips: Array<string>;

      percentage: number;

      size: number;

      type: string;
    }

    export interface ServerStat {
      count: number;

      countries: Array<string>;

      encodedSize: number;

      ips: Array<string>;

      server: string;

      size: number;
    }

    export interface TLSStat {
      count: number;

      countries: Array<string>;

      encodedSize: number;

      ips: Array<string>;

      protocols: TLSStat.Protocols;

      securityState: string;

      size: number;
    }

    export namespace TLSStat {
      export interface Protocols {
        'TLS 1.3 / AES_128_GCM': number;
      }
    }
  }

  export interface Task {
    apexDomain: string;

    domain: string;

    domURL: string;

    method: string;

    options: Task.Options;

    reportURL: string;

    screenshotURL: string;

    source: string;

    success: boolean;

    time: string;

    url: string;

    uuid: string;

    visibility: string;
  }

  export namespace Task {
    export interface Options {
      /**
       * Custom headers set.
       */
      customHeaders?: unknown;

      screenshotsResolutions?: Array<string>;
    }
  }

  export interface Verdicts {
    overall: Verdicts.Overall;
  }

  export namespace Verdicts {
    export interface Overall {
      categories: Array<string>;

      hasVerdicts: boolean;

      malicious: boolean;

      tags: Array<string>;
    }
  }
}

export interface ScanHARResponse {
  log: ScanHARResponse.Log;
}

export namespace ScanHARResponse {
  export interface Log {
    creator: Log.Creator;

    entries: Array<Log.Entry>;

    pages: Array<Log.Page>;

    version: string;
  }

  export namespace Log {
    export interface Creator {
      comment: string;

      name: string;

      version: string;
    }

    export interface Entry {
      _initialPriority: string;

      _initiator_type: string;

      _priority: string;

      _requestId: string;

      _requestTime: number;

      _resourceType: string;

      cache: unknown;

      connection: string;

      pageref: string;

      request: Entry.Request;

      response: Entry.Response;

      serverIPAddress: string;

      startedDateTime: string;

      time: number;
    }

    export namespace Entry {
      export interface Request {
        bodySize: number;

        headers: Array<Request.Header>;

        headersSize: number;

        httpVersion: string;

        method: string;

        url: string;
      }

      export namespace Request {
        export interface Header {
          name: string;

          value: string;
        }
      }

      export interface Response {
        _transferSize: number;

        bodySize: number;

        content: Response.Content;

        headers: Array<Response.Header>;

        headersSize: number;

        httpVersion: string;

        redirectURL: string;

        status: number;

        statusText: string;
      }

      export namespace Response {
        export interface Content {
          mimeType: string;

          size: number;

          compression?: number;
        }

        export interface Header {
          name: string;

          value: string;
        }
      }
    }

    export interface Page {
      id: string;

      pageTimings: Page.PageTimings;

      startedDateTime: string;

      title: string;
    }

    export namespace Page {
      export interface PageTimings {
        onContentLoad: number;

        onLoad: number;
      }
    }
  }
}

export interface ScanCreateParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Body param:
   */
  url: string;

  /**
   * Body param: Country to geo egress from
   */
  country?:
    | 'AF'
    | 'AL'
    | 'DZ'
    | 'AD'
    | 'AO'
    | 'AG'
    | 'AR'
    | 'AM'
    | 'AU'
    | 'AT'
    | 'AZ'
    | 'BH'
    | 'BD'
    | 'BB'
    | 'BY'
    | 'BE'
    | 'BZ'
    | 'BJ'
    | 'BM'
    | 'BT'
    | 'BO'
    | 'BA'
    | 'BW'
    | 'BR'
    | 'BN'
    | 'BG'
    | 'BF'
    | 'BI'
    | 'KH'
    | 'CM'
    | 'CA'
    | 'CV'
    | 'KY'
    | 'CF'
    | 'TD'
    | 'CL'
    | 'CN'
    | 'CO'
    | 'KM'
    | 'CG'
    | 'CR'
    | 'CI'
    | 'HR'
    | 'CU'
    | 'CY'
    | 'CZ'
    | 'CD'
    | 'DK'
    | 'DJ'
    | 'DM'
    | 'DO'
    | 'EC'
    | 'EG'
    | 'SV'
    | 'GQ'
    | 'ER'
    | 'EE'
    | 'SZ'
    | 'ET'
    | 'FJ'
    | 'FI'
    | 'FR'
    | 'GA'
    | 'GE'
    | 'DE'
    | 'GH'
    | 'GR'
    | 'GL'
    | 'GD'
    | 'GT'
    | 'GN'
    | 'GW'
    | 'GY'
    | 'HT'
    | 'HN'
    | 'HU'
    | 'IS'
    | 'IN'
    | 'ID'
    | 'IR'
    | 'IQ'
    | 'IE'
    | 'IL'
    | 'IT'
    | 'JM'
    | 'JP'
    | 'JO'
    | 'KZ'
    | 'KE'
    | 'KI'
    | 'KW'
    | 'KG'
    | 'LA'
    | 'LV'
    | 'LB'
    | 'LS'
    | 'LR'
    | 'LY'
    | 'LI'
    | 'LT'
    | 'LU'
    | 'MO'
    | 'MG'
    | 'MW'
    | 'MY'
    | 'MV'
    | 'ML'
    | 'MR'
    | 'MU'
    | 'MX'
    | 'FM'
    | 'MD'
    | 'MC'
    | 'MN'
    | 'MS'
    | 'MA'
    | 'MZ'
    | 'MM'
    | 'NA'
    | 'NR'
    | 'NP'
    | 'NL'
    | 'NZ'
    | 'NI'
    | 'NE'
    | 'NG'
    | 'KP'
    | 'MK'
    | 'NO'
    | 'OM'
    | 'PK'
    | 'PS'
    | 'PA'
    | 'PG'
    | 'PY'
    | 'PE'
    | 'PH'
    | 'PL'
    | 'PT'
    | 'QA'
    | 'RO'
    | 'RU'
    | 'RW'
    | 'SH'
    | 'KN'
    | 'LC'
    | 'VC'
    | 'WS'
    | 'SM'
    | 'ST'
    | 'SA'
    | 'SN'
    | 'RS'
    | 'SC'
    | 'SL'
    | 'SK'
    | 'SI'
    | 'SB'
    | 'SO'
    | 'ZA'
    | 'KR'
    | 'SS'
    | 'ES'
    | 'LK'
    | 'SD'
    | 'SR'
    | 'SE'
    | 'CH'
    | 'SY'
    | 'TW'
    | 'TJ'
    | 'TZ'
    | 'TH'
    | 'BS'
    | 'GM'
    | 'TL'
    | 'TG'
    | 'TO'
    | 'TT'
    | 'TN'
    | 'TR'
    | 'TM'
    | 'UG'
    | 'UA'
    | 'AE'
    | 'GB'
    | 'US'
    | 'UY'
    | 'UZ'
    | 'VU'
    | 'VE'
    | 'VN'
    | 'YE'
    | 'ZM'
    | 'ZW';

  /**
   * Body param:
   */
  customagent?: string;

  /**
   * Body param: Set custom headers.
   */
  customHeaders?: { [key: string]: string };

  /**
   * Body param:
   */
  referer?: string;

  /**
   * Body param: Take multiple screenshots targeting different device types.
   */
  screenshotsResolutions?: Array<'desktop' | 'mobile' | 'tablet'>;

  /**
   * Body param: The option `Public` means it will be included in listings like
   * recent scans and search results. `Unlisted` means it will not be included in the
   * aforementioned listings, users will need to have the scan's ID to access it. A a
   * scan will be automatically marked as unlisted if it fails, if it contains
   * potential PII or other sensitive material.
   */
  visibility?: 'Public' | 'Unlisted';
}

export interface ScanListParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Query param: Filter scans
   */
  q?: string;

  /**
   * Query param: Limit the number of objects in the response.
   */
  size?: number;
}

export interface ScanBulkCreateParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Body param: List of urls to scan (up to a 100).
   */
  body?: Array<ScanBulkCreateParams.Body>;
}

export namespace ScanBulkCreateParams {
  export interface Body {
    url: string;

    customagent?: string;

    /**
     * Set custom headers.
     */
    customHeaders?: { [key: string]: string };

    referer?: string;

    /**
     * Take multiple screenshots targeting different device types.
     */
    screenshotsResolutions?: Array<'desktop' | 'mobile' | 'tablet'>;

    /**
     * The option `Public` means it will be included in listings like recent scans and
     * search results. `Unlisted` means it will not be included in the aforementioned
     * listings, users will need to have the scan's ID to access it. A a scan will be
     * automatically marked as unlisted if it fails, if it contains potential PII or
     * other sensitive material.
     */
    visibility?: 'Public' | 'Unlisted';
  }
}

export interface ScanDOMParams {
  /**
   * Account ID.
   */
  account_id: string;
}

export interface ScanGetParams {
  /**
   * Account ID.
   */
  account_id: string;
}

export interface ScanHARParams {
  /**
   * Account ID.
   */
  account_id: string;
}

export interface ScanScreenshotParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Query param: Target device type.
   */
  resolution?: 'desktop' | 'mobile' | 'tablet';
}

export declare namespace Scans {
  export {
    type ScanCreateResponse as ScanCreateResponse,
    type ScanListResponse as ScanListResponse,
    type ScanBulkCreateResponse as ScanBulkCreateResponse,
    type ScanDOMResponse as ScanDOMResponse,
    type ScanGetResponse as ScanGetResponse,
    type ScanHARResponse as ScanHARResponse,
    type ScanCreateParams as ScanCreateParams,
    type ScanListParams as ScanListParams,
    type ScanBulkCreateParams as ScanBulkCreateParams,
    type ScanDOMParams as ScanDOMParams,
    type ScanGetParams as ScanGetParams,
    type ScanHARParams as ScanHARParams,
    type ScanScreenshotParams as ScanScreenshotParams,
  };
}
