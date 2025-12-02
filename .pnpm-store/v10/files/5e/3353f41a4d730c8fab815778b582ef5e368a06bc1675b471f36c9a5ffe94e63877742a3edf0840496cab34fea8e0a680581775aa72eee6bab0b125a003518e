// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Zone extends APIResource {
  /**
   * Update DNS settings for a zone
   *
   * @example
   * ```ts
   * const response = await client.dns.settings.zone.edit({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  edit(params: ZoneEditParams, options?: Core.RequestOptions): Core.APIPromise<ZoneEditResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.patch(`/zones/${zone_id}/dns_settings`, { body, ...options }) as Core.APIPromise<{
        result: ZoneEditResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Show DNS settings for a zone
   *
   * @example
   * ```ts
   * const zone = await client.dns.settings.zone.get({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(params: ZoneGetParams, options?: Core.RequestOptions): Core.APIPromise<ZoneGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/dns_settings`, options) as Core.APIPromise<{
        result: ZoneGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface ZoneEditResponse {
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
  internal_dns?: ZoneEditResponse.InternalDNS;

  /**
   * Whether to enable multi-provider DNS, which causes Cloudflare to activate the
   * zone even when non-Cloudflare NS records exist, and to respect NS records at the
   * zone apex during outbound zone transfers.
   */
  multi_provider?: boolean;

  /**
   * Settings determining the nameservers through which the zone should be available.
   */
  nameservers?: ZoneEditResponse.Nameservers;

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
  soa?: ZoneEditResponse.SOA;

  /**
   * Whether the zone mode is a regular or CDN/DNS only zone.
   */
  zone_mode?: 'standard' | 'cdn_only' | 'dns_only';
}

export namespace ZoneEditResponse {
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
    type: 'cloudflare.standard' | 'custom.account' | 'custom.tenant' | 'custom.zone';

    /**
     * Configured nameserver set to be used for this zone
     */
    ns_set?: number;
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

export interface ZoneGetResponse {
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
  internal_dns?: ZoneGetResponse.InternalDNS;

  /**
   * Whether to enable multi-provider DNS, which causes Cloudflare to activate the
   * zone even when non-Cloudflare NS records exist, and to respect NS records at the
   * zone apex during outbound zone transfers.
   */
  multi_provider?: boolean;

  /**
   * Settings determining the nameservers through which the zone should be available.
   */
  nameservers?: ZoneGetResponse.Nameservers;

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
  soa?: ZoneGetResponse.SOA;

  /**
   * Whether the zone mode is a regular or CDN/DNS only zone.
   */
  zone_mode?: 'standard' | 'cdn_only' | 'dns_only';
}

export namespace ZoneGetResponse {
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
    type: 'cloudflare.standard' | 'custom.account' | 'custom.tenant' | 'custom.zone';

    /**
     * Configured nameserver set to be used for this zone
     */
    ns_set?: number;
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

export interface ZoneEditParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: Whether to flatten all CNAME records in the zone. Note that, due to
   * DNS limitations, a CNAME record at the zone apex will always be flattened.
   */
  flatten_all_cnames?: boolean;

  /**
   * Body param: Whether to enable Foundation DNS Advanced Nameservers on the zone.
   */
  foundation_dns?: boolean;

  /**
   * Body param: Settings for this internal zone.
   */
  internal_dns?: ZoneEditParams.InternalDNS;

  /**
   * Body param: Whether to enable multi-provider DNS, which causes Cloudflare to
   * activate the zone even when non-Cloudflare NS records exist, and to respect NS
   * records at the zone apex during outbound zone transfers.
   */
  multi_provider?: boolean;

  /**
   * Body param: Settings determining the nameservers through which the zone should
   * be available.
   */
  nameservers?: ZoneEditParams.Nameservers;

  /**
   * Body param: The time to live (TTL) of the zone's nameserver (NS) records.
   */
  ns_ttl?: number;

  /**
   * Body param: Allows a Secondary DNS zone to use (proxied) override records and
   * CNAME flattening at the zone apex.
   */
  secondary_overrides?: boolean;

  /**
   * Body param: Components of the zone's SOA record.
   */
  soa?: ZoneEditParams.SOA;

  /**
   * Body param: Whether the zone mode is a regular or CDN/DNS only zone.
   */
  zone_mode?: 'standard' | 'cdn_only' | 'dns_only';
}

export namespace ZoneEditParams {
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
    type: 'cloudflare.standard' | 'custom.account' | 'custom.tenant' | 'custom.zone';

    /**
     * Configured nameserver set to be used for this zone
     */
    ns_set?: number;
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

export interface ZoneGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export declare namespace Zone {
  export {
    type ZoneEditResponse as ZoneEditResponse,
    type ZoneGetResponse as ZoneGetResponse,
    type ZoneEditParams as ZoneEditParams,
    type ZoneGetParams as ZoneGetParams,
  };
}
