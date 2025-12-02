// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import * as ViewsAPI from './views';
import {
  ViewCreateParams,
  ViewCreateResponse,
  ViewDeleteParams,
  ViewDeleteResponse,
  ViewEditParams,
  ViewEditResponse,
  ViewGetParams,
  ViewGetResponse,
  ViewListParams,
  ViewListResponse,
  ViewListResponsesV4PagePaginationArray,
  Views,
} from './views';

export class Account extends APIResource {
  views: ViewsAPI.Views = new ViewsAPI.Views(this._client);

  /**
   * Update DNS settings for an account
   *
   * @example
   * ```ts
   * const response = await client.dns.settings.account.edit({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  edit(params: AccountEditParams, options?: Core.RequestOptions): Core.APIPromise<AccountEditResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/dns_settings`, { body, ...options }) as Core.APIPromise<{
        result: AccountEditResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Show DNS settings for an account
   *
   * @example
   * ```ts
   * const account = await client.dns.settings.account.get({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(params: AccountGetParams, options?: Core.RequestOptions): Core.APIPromise<AccountGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/dns_settings`, options) as Core.APIPromise<{
        result: AccountGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface AccountEditResponse {
  zone_defaults?: AccountEditResponse.ZoneDefaults;
}

export namespace AccountEditResponse {
  export interface ZoneDefaults {
    /**
     * Whether to flatten all CNAME records in the zone. Note that, due to DNS
     * limitations, a CNAME record at the zone apex will always be flattened.
     */
    flatten_all_cnames?: boolean;

    /**
     * Whether to enable Foundation DNS Advanced Nameservers on the zone.
     */
    foundation_dns?: boolean;

    /**
     * Settings for this internal zone.
     */
    internal_dns?: ZoneDefaults.InternalDNS;

    /**
     * Whether to enable multi-provider DNS, which causes Cloudflare to activate the
     * zone even when non-Cloudflare NS records exist, and to respect NS records at the
     * zone apex during outbound zone transfers.
     */
    multi_provider?: boolean;

    /**
     * Settings determining the nameservers through which the zone should be available.
     */
    nameservers?: ZoneDefaults.Nameservers;

    /**
     * The time to live (TTL) of the zone's nameserver (NS) records.
     */
    ns_ttl?: number;

    /**
     * Allows a Secondary DNS zone to use (proxied) override records and CNAME
     * flattening at the zone apex.
     */
    secondary_overrides?: boolean;

    /**
     * Components of the zone's SOA record.
     */
    soa?: ZoneDefaults.SOA;

    /**
     * Whether the zone mode is a regular or CDN/DNS only zone.
     */
    zone_mode?: 'standard' | 'cdn_only' | 'dns_only';
  }

  export namespace ZoneDefaults {
    /**
     * Settings for this internal zone.
     */
    export interface InternalDNS {
      /**
       * The ID of the zone to fallback to.
       */
      reference_zone_id?: string;
    }

    /**
     * Settings determining the nameservers through which the zone should be available.
     */
    export interface Nameservers {
      /**
       * Nameserver type
       */
      type: 'cloudflare.standard' | 'cloudflare.standard.random' | 'custom.account' | 'custom.tenant';
    }

    /**
     * Components of the zone's SOA record.
     */
    export interface SOA {
      /**
       * Time in seconds of being unable to query the primary server after which
       * secondary servers should stop serving the zone.
       */
      expire: number;

      /**
       * The time to live (TTL) for negative caching of records within the zone.
       */
      min_ttl: number;

      /**
       * The primary nameserver, which may be used for outbound zone transfers.
       */
      mname: string;

      /**
       * Time in seconds after which secondary servers should re-check the SOA record to
       * see if the zone has been updated.
       */
      refresh: number;

      /**
       * Time in seconds after which secondary servers should retry queries after the
       * primary server was unresponsive.
       */
      retry: number;

      /**
       * The email address of the zone administrator, with the first label representing
       * the local part of the email address.
       */
      rname: string;

      /**
       * The time to live (TTL) of the SOA record itself.
       */
      ttl: number;
    }
  }
}

export interface AccountGetResponse {
  zone_defaults?: AccountGetResponse.ZoneDefaults;
}

export namespace AccountGetResponse {
  export interface ZoneDefaults {
    /**
     * Whether to flatten all CNAME records in the zone. Note that, due to DNS
     * limitations, a CNAME record at the zone apex will always be flattened.
     */
    flatten_all_cnames?: boolean;

    /**
     * Whether to enable Foundation DNS Advanced Nameservers on the zone.
     */
    foundation_dns?: boolean;

    /**
     * Settings for this internal zone.
     */
    internal_dns?: ZoneDefaults.InternalDNS;

    /**
     * Whether to enable multi-provider DNS, which causes Cloudflare to activate the
     * zone even when non-Cloudflare NS records exist, and to respect NS records at the
     * zone apex during outbound zone transfers.
     */
    multi_provider?: boolean;

    /**
     * Settings determining the nameservers through which the zone should be available.
     */
    nameservers?: ZoneDefaults.Nameservers;

    /**
     * The time to live (TTL) of the zone's nameserver (NS) records.
     */
    ns_ttl?: number;

    /**
     * Allows a Secondary DNS zone to use (proxied) override records and CNAME
     * flattening at the zone apex.
     */
    secondary_overrides?: boolean;

    /**
     * Components of the zone's SOA record.
     */
    soa?: ZoneDefaults.SOA;

    /**
     * Whether the zone mode is a regular or CDN/DNS only zone.
     */
    zone_mode?: 'standard' | 'cdn_only' | 'dns_only';
  }

  export namespace ZoneDefaults {
    /**
     * Settings for this internal zone.
     */
    export interface InternalDNS {
      /**
       * The ID of the zone to fallback to.
       */
      reference_zone_id?: string;
    }

    /**
     * Settings determining the nameservers through which the zone should be available.
     */
    export interface Nameservers {
      /**
       * Nameserver type
       */
      type: 'cloudflare.standard' | 'cloudflare.standard.random' | 'custom.account' | 'custom.tenant';
    }

    /**
     * Components of the zone's SOA record.
     */
    export interface SOA {
      /**
       * Time in seconds of being unable to query the primary server after which
       * secondary servers should stop serving the zone.
       */
      expire: number;

      /**
       * The time to live (TTL) for negative caching of records within the zone.
       */
      min_ttl: number;

      /**
       * The primary nameserver, which may be used for outbound zone transfers.
       */
      mname: string;

      /**
       * Time in seconds after which secondary servers should re-check the SOA record to
       * see if the zone has been updated.
       */
      refresh: number;

      /**
       * Time in seconds after which secondary servers should retry queries after the
       * primary server was unresponsive.
       */
      retry: number;

      /**
       * The email address of the zone administrator, with the first label representing
       * the local part of the email address.
       */
      rname: string;

      /**
       * The time to live (TTL) of the SOA record itself.
       */
      ttl: number;
    }
  }
}

export interface AccountEditParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param:
   */
  zone_defaults?: AccountEditParams.ZoneDefaults;
}

export namespace AccountEditParams {
  export interface ZoneDefaults {
    /**
     * Whether to flatten all CNAME records in the zone. Note that, due to DNS
     * limitations, a CNAME record at the zone apex will always be flattened.
     */
    flatten_all_cnames?: boolean;

    /**
     * Whether to enable Foundation DNS Advanced Nameservers on the zone.
     */
    foundation_dns?: boolean;

    /**
     * Settings for this internal zone.
     */
    internal_dns?: ZoneDefaults.InternalDNS;

    /**
     * Whether to enable multi-provider DNS, which causes Cloudflare to activate the
     * zone even when non-Cloudflare NS records exist, and to respect NS records at the
     * zone apex during outbound zone transfers.
     */
    multi_provider?: boolean;

    /**
     * Settings determining the nameservers through which the zone should be available.
     */
    nameservers?: ZoneDefaults.Nameservers;

    /**
     * The time to live (TTL) of the zone's nameserver (NS) records.
     */
    ns_ttl?: number;

    /**
     * Allows a Secondary DNS zone to use (proxied) override records and CNAME
     * flattening at the zone apex.
     */
    secondary_overrides?: boolean;

    /**
     * Components of the zone's SOA record.
     */
    soa?: ZoneDefaults.SOA;

    /**
     * Whether the zone mode is a regular or CDN/DNS only zone.
     */
    zone_mode?: 'standard' | 'cdn_only' | 'dns_only';
  }

  export namespace ZoneDefaults {
    /**
     * Settings for this internal zone.
     */
    export interface InternalDNS {
      /**
       * The ID of the zone to fallback to.
       */
      reference_zone_id?: string;
    }

    /**
     * Settings determining the nameservers through which the zone should be available.
     */
    export interface Nameservers {
      /**
       * Nameserver type
       */
      type: 'cloudflare.standard' | 'cloudflare.standard.random' | 'custom.account' | 'custom.tenant';
    }

    /**
     * Components of the zone's SOA record.
     */
    export interface SOA {
      /**
       * Time in seconds of being unable to query the primary server after which
       * secondary servers should stop serving the zone.
       */
      expire: number;

      /**
       * The time to live (TTL) for negative caching of records within the zone.
       */
      min_ttl: number;

      /**
       * The primary nameserver, which may be used for outbound zone transfers.
       */
      mname: string;

      /**
       * Time in seconds after which secondary servers should re-check the SOA record to
       * see if the zone has been updated.
       */
      refresh: number;

      /**
       * Time in seconds after which secondary servers should retry queries after the
       * primary server was unresponsive.
       */
      retry: number;

      /**
       * The email address of the zone administrator, with the first label representing
       * the local part of the email address.
       */
      rname: string;

      /**
       * The time to live (TTL) of the SOA record itself.
       */
      ttl: number;
    }
  }
}

export interface AccountGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

Account.Views = Views;
Account.ViewListResponsesV4PagePaginationArray = ViewListResponsesV4PagePaginationArray;

export declare namespace Account {
  export {
    type AccountEditResponse as AccountEditResponse,
    type AccountGetResponse as AccountGetResponse,
    type AccountEditParams as AccountEditParams,
    type AccountGetParams as AccountGetParams,
  };

  export {
    Views as Views,
    type ViewCreateResponse as ViewCreateResponse,
    type ViewListResponse as ViewListResponse,
    type ViewDeleteResponse as ViewDeleteResponse,
    type ViewEditResponse as ViewEditResponse,
    type ViewGetResponse as ViewGetResponse,
    ViewListResponsesV4PagePaginationArray as ViewListResponsesV4PagePaginationArray,
    type ViewCreateParams as ViewCreateParams,
    type ViewListParams as ViewListParams,
    type ViewDeleteParams as ViewDeleteParams,
    type ViewEditParams as ViewEditParams,
    type ViewGetParams as ViewGetParams,
  };
}
