// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as DNSAPI from './dns';
import * as EmailRoutingAPI from './email-routing';
import { SinglePage } from '../../pagination';

export class DNS extends APIResource {
  /**
   * Enable you Email Routing zone. Add and lock the necessary MX and SPF records.
   *
   * @example
   * ```ts
   * const settings = await client.emailRouting.dns.create({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   name: 'example.net',
   * });
   * ```
   */
  create(params: DNSCreateParams, options?: Core.RequestOptions): Core.APIPromise<EmailRoutingAPI.Settings> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/email/routing/dns`, { body, ...options }) as Core.APIPromise<{
        result: EmailRoutingAPI.Settings;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Disable your Email Routing zone. Also removes additional MX records previously
   * required for Email Routing to work.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const dnsRecord of client.emailRouting.dns.delete(
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  delete(
    params: DNSDeleteParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<DNSRecordsSinglePage, DNSRecord> {
    const { zone_id } = params;
    return this._client.getAPIList(`/zones/${zone_id}/email/routing/dns`, DNSRecordsSinglePage, {
      method: 'delete',
      ...options,
    });
  }

  /**
   * Unlock MX Records previously locked by Email Routing.
   *
   * @example
   * ```ts
   * const settings = await client.emailRouting.dns.edit({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   name: 'example.net',
   * });
   * ```
   */
  edit(params: DNSEditParams, options?: Core.RequestOptions): Core.APIPromise<EmailRoutingAPI.Settings> {
    const { zone_id, ...body } = params;
    return (
      this._client.patch(`/zones/${zone_id}/email/routing/dns`, { body, ...options }) as Core.APIPromise<{
        result: EmailRoutingAPI.Settings;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Show the DNS records needed to configure your Email Routing zone.
   *
   * @example
   * ```ts
   * const dns = await client.emailRouting.dns.get({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(params: DNSGetParams, options?: Core.RequestOptions): Core.APIPromise<DNSGetResponse> {
    const { zone_id, ...query } = params;
    return this._client.get(`/zones/${zone_id}/email/routing/dns`, { query, ...options });
  }
}

export class DNSRecordsSinglePage extends SinglePage<DNSRecord> {}

/**
 * List of records needed to enable an Email Routing zone.
 */
export interface DNSRecord {
  /**
   * DNS record content.
   */
  content?: string;

  /**
   * DNS record name (or @ for the zone apex).
   */
  name?: string;

  /**
   * Required for MX, SRV and URI records. Unused by other record types. Records with
   * lower priorities are preferred.
   */
  priority?: number;

  /**
   * Time to live, in seconds, of the DNS record. Must be between 60 and 86400, or 1
   * for 'automatic'.
   */
  ttl?: number | 1;

  /**
   * DNS record type.
   */
  type?:
    | 'A'
    | 'AAAA'
    | 'CNAME'
    | 'HTTPS'
    | 'TXT'
    | 'SRV'
    | 'LOC'
    | 'MX'
    | 'NS'
    | 'CERT'
    | 'DNSKEY'
    | 'DS'
    | 'NAPTR'
    | 'SMIMEA'
    | 'SSHFP'
    | 'SVCB'
    | 'TLSA'
    | 'URI';
}

export type DNSGetResponse =
  | DNSGetResponse.EmailEmailRoutingDNSQueryResponse
  | DNSGetResponse.EmailDNSSettingsResponseCollection;

export namespace DNSGetResponse {
  export interface EmailEmailRoutingDNSQueryResponse {
    errors: Array<EmailEmailRoutingDNSQueryResponse.Error>;

    messages: Array<EmailEmailRoutingDNSQueryResponse.Message>;

    /**
     * Whether the API call was successful.
     */
    success: true;

    result?: EmailEmailRoutingDNSQueryResponse.Result;

    result_info?: EmailEmailRoutingDNSQueryResponse.ResultInfo;
  }

  export namespace EmailEmailRoutingDNSQueryResponse {
    export interface Error {
      code: number;

      message: string;

      documentation_url?: string;

      source?: Error.Source;
    }

    export namespace Error {
      export interface Source {
        pointer?: string;
      }
    }

    export interface Message {
      code: number;

      message: string;

      documentation_url?: string;

      source?: Message.Source;
    }

    export namespace Message {
      export interface Source {
        pointer?: string;
      }
    }

    export interface Result {
      errors?: Array<Result.Error>;

      record?: Array<DNSAPI.DNSRecord>;
    }

    export namespace Result {
      export interface Error {
        code?: string;

        /**
         * List of records needed to enable an Email Routing zone.
         */
        missing?: DNSAPI.DNSRecord;
      }
    }

    export interface ResultInfo {
      /**
       * Total number of results for the requested service.
       */
      count?: number;

      /**
       * Current page within paginated list of results.
       */
      page?: number;

      /**
       * Number of results per page of results.
       */
      per_page?: number;

      /**
       * Total results available without any search parameters.
       */
      total_count?: number;
    }
  }

  export interface EmailDNSSettingsResponseCollection {
    errors: Array<EmailDNSSettingsResponseCollection.Error>;

    messages: Array<EmailDNSSettingsResponseCollection.Message>;

    /**
     * Whether the API call was successful.
     */
    success: true;

    result?: Array<DNSAPI.DNSRecord>;

    result_info?: EmailDNSSettingsResponseCollection.ResultInfo;
  }

  export namespace EmailDNSSettingsResponseCollection {
    export interface Error {
      code: number;

      message: string;

      documentation_url?: string;

      source?: Error.Source;
    }

    export namespace Error {
      export interface Source {
        pointer?: string;
      }
    }

    export interface Message {
      code: number;

      message: string;

      documentation_url?: string;

      source?: Message.Source;
    }

    export namespace Message {
      export interface Source {
        pointer?: string;
      }
    }

    export interface ResultInfo {
      /**
       * Total number of results for the requested service.
       */
      count?: number;

      /**
       * Current page within paginated list of results.
       */
      page?: number;

      /**
       * Number of results per page of results.
       */
      per_page?: number;

      /**
       * Total results available without any search parameters.
       */
      total_count?: number;
    }
  }
}

export interface DNSCreateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: Domain of your zone.
   */
  name: string;
}

export interface DNSDeleteParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export interface DNSEditParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: Domain of your zone.
   */
  name: string;
}

export interface DNSGetParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Query param: Domain of your zone.
   */
  subdomain?: string;
}

DNS.DNSRecordsSinglePage = DNSRecordsSinglePage;

export declare namespace DNS {
  export {
    type DNSRecord as DNSRecord,
    type DNSGetResponse as DNSGetResponse,
    DNSRecordsSinglePage as DNSRecordsSinglePage,
    type DNSCreateParams as DNSCreateParams,
    type DNSDeleteParams as DNSDeleteParams,
    type DNSEditParams as DNSEditParams,
    type DNSGetParams as DNSGetParams,
  };
}
