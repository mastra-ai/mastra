// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../../resource';
import * as Core from '../../../../../core';
import * as PoliciesAPI from '../policies';
import * as CertificatesAPI from './certificates';
import { CertificateEditParams, CertificateGetParams, Certificates } from './certificates';
import * as ExcludesAPI from './excludes';
import { ExcludeGetParams, ExcludeUpdateParams, Excludes } from './excludes';
import * as FallbackDomainsAPI from './fallback-domains';
import { FallbackDomainGetParams, FallbackDomainUpdateParams, FallbackDomains } from './fallback-domains';
import * as IncludesAPI from './includes';
import { IncludeGetParams, IncludeUpdateParams, Includes } from './includes';

export class Default extends APIResource {
  excludes: ExcludesAPI.Excludes = new ExcludesAPI.Excludes(this._client);
  includes: IncludesAPI.Includes = new IncludesAPI.Includes(this._client);
  fallbackDomains: FallbackDomainsAPI.FallbackDomains = new FallbackDomainsAPI.FallbackDomains(this._client);
  certificates: CertificatesAPI.Certificates = new CertificatesAPI.Certificates(this._client);

  /**
   * Updates the default device settings profile for an account.
   *
   * @example
   * ```ts
   * const response =
   *   await client.zeroTrust.devices.policies.default.edit({
   *     account_id: '699d98642c564d2e855e9661899b7252',
   *   });
   * ```
   */
  edit(
    params: DefaultEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DefaultEditResponse | null> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/devices/policy`, { body, ...options }) as Core.APIPromise<{
        result: DefaultEditResponse | null;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches the default device settings profile for an account.
   *
   * @example
   * ```ts
   * const _default =
   *   await client.zeroTrust.devices.policies.default.get({
   *     account_id: '699d98642c564d2e855e9661899b7252',
   *   });
   * ```
   */
  get(params: DefaultGetParams, options?: Core.RequestOptions): Core.APIPromise<DefaultGetResponse | null> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/devices/policy`, options) as Core.APIPromise<{
        result: DefaultGetResponse | null;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface DefaultEditResponse {
  /**
   * Whether to allow the user to switch WARP between modes.
   */
  allow_mode_switch?: boolean;

  /**
   * Whether to receive update notifications when a new version of the client is
   * available.
   */
  allow_updates?: boolean;

  /**
   * Whether to allow devices to leave the organization.
   */
  allowed_to_leave?: boolean;

  /**
   * The amount of time in seconds to reconnect after having been disabled.
   */
  auto_connect?: number;

  /**
   * Turn on the captive portal after the specified amount of time.
   */
  captive_portal?: number;

  /**
   * Whether the policy will be applied to matching devices.
   */
  default?: boolean;

  /**
   * If the `dns_server` field of a fallback domain is not present, the client will
   * fall back to a best guess of the default/system DNS resolvers unless this policy
   * option is set to `true`.
   */
  disable_auto_fallback?: boolean;

  /**
   * Whether the policy will be applied to matching devices.
   */
  enabled?: boolean;

  /**
   * List of routes excluded in the WARP client's tunnel.
   */
  exclude?: Array<PoliciesAPI.SplitTunnelExclude>;

  /**
   * Whether to add Microsoft IPs to Split Tunnel exclusions.
   */
  exclude_office_ips?: boolean;

  fallback_domains?: Array<PoliciesAPI.FallbackDomain>;

  gateway_unique_id?: string;

  /**
   * List of routes included in the WARP client's tunnel.
   */
  include?: Array<PoliciesAPI.SplitTunnelInclude>;

  /**
   * Determines if the operating system will register WARP's local interface IP with
   * your on-premises DNS server.
   */
  register_interface_ip_with_dns?: boolean;

  /**
   * Determines whether the WARP client indicates to SCCM that it is inside a VPN
   * boundary. (Windows only).
   */
  sccm_vpn_boundary_support?: boolean;

  service_mode_v2?: DefaultEditResponse.ServiceModeV2;

  /**
   * The URL to launch when the Send Feedback button is clicked.
   */
  support_url?: string;

  /**
   * Whether to allow the user to turn off the WARP switch and disconnect the client.
   */
  switch_locked?: boolean;

  /**
   * Determines which tunnel protocol to use.
   */
  tunnel_protocol?: string;
}

export namespace DefaultEditResponse {
  export interface ServiceModeV2 {
    /**
     * The mode to run the WARP client under.
     */
    mode?: string;

    /**
     * The port number when used with proxy mode.
     */
    port?: number;
  }
}

export interface DefaultGetResponse {
  /**
   * Whether to allow the user to switch WARP between modes.
   */
  allow_mode_switch?: boolean;

  /**
   * Whether to receive update notifications when a new version of the client is
   * available.
   */
  allow_updates?: boolean;

  /**
   * Whether to allow devices to leave the organization.
   */
  allowed_to_leave?: boolean;

  /**
   * The amount of time in seconds to reconnect after having been disabled.
   */
  auto_connect?: number;

  /**
   * Turn on the captive portal after the specified amount of time.
   */
  captive_portal?: number;

  /**
   * Whether the policy will be applied to matching devices.
   */
  default?: boolean;

  /**
   * If the `dns_server` field of a fallback domain is not present, the client will
   * fall back to a best guess of the default/system DNS resolvers unless this policy
   * option is set to `true`.
   */
  disable_auto_fallback?: boolean;

  /**
   * Whether the policy will be applied to matching devices.
   */
  enabled?: boolean;

  /**
   * List of routes excluded in the WARP client's tunnel.
   */
  exclude?: Array<PoliciesAPI.SplitTunnelExclude>;

  /**
   * Whether to add Microsoft IPs to Split Tunnel exclusions.
   */
  exclude_office_ips?: boolean;

  fallback_domains?: Array<PoliciesAPI.FallbackDomain>;

  gateway_unique_id?: string;

  /**
   * List of routes included in the WARP client's tunnel.
   */
  include?: Array<PoliciesAPI.SplitTunnelInclude>;

  /**
   * Determines if the operating system will register WARP's local interface IP with
   * your on-premises DNS server.
   */
  register_interface_ip_with_dns?: boolean;

  /**
   * Determines whether the WARP client indicates to SCCM that it is inside a VPN
   * boundary. (Windows only).
   */
  sccm_vpn_boundary_support?: boolean;

  service_mode_v2?: DefaultGetResponse.ServiceModeV2;

  /**
   * The URL to launch when the Send Feedback button is clicked.
   */
  support_url?: string;

  /**
   * Whether to allow the user to turn off the WARP switch and disconnect the client.
   */
  switch_locked?: boolean;

  /**
   * Determines which tunnel protocol to use.
   */
  tunnel_protocol?: string;
}

export namespace DefaultGetResponse {
  export interface ServiceModeV2 {
    /**
     * The mode to run the WARP client under.
     */
    mode?: string;

    /**
     * The port number when used with proxy mode.
     */
    port?: number;
  }
}

export interface DefaultEditParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: Whether to allow the user to switch WARP between modes.
   */
  allow_mode_switch?: boolean;

  /**
   * Body param: Whether to receive update notifications when a new version of the
   * client is available.
   */
  allow_updates?: boolean;

  /**
   * Body param: Whether to allow devices to leave the organization.
   */
  allowed_to_leave?: boolean;

  /**
   * Body param: The amount of time in seconds to reconnect after having been
   * disabled.
   */
  auto_connect?: number;

  /**
   * Body param: Turn on the captive portal after the specified amount of time.
   */
  captive_portal?: number;

  /**
   * Body param: If the `dns_server` field of a fallback domain is not present, the
   * client will fall back to a best guess of the default/system DNS resolvers unless
   * this policy option is set to `true`.
   */
  disable_auto_fallback?: boolean;

  /**
   * Body param: List of routes excluded in the WARP client's tunnel. Both 'exclude'
   * and 'include' cannot be set in the same request.
   */
  exclude?: Array<PoliciesAPI.SplitTunnelExcludeParam>;

  /**
   * Body param: Whether to add Microsoft IPs to Split Tunnel exclusions.
   */
  exclude_office_ips?: boolean;

  /**
   * Body param: List of routes included in the WARP client's tunnel. Both 'exclude'
   * and 'include' cannot be set in the same request.
   */
  include?: Array<PoliciesAPI.SplitTunnelIncludeParam>;

  /**
   * Body param: The amount of time in minutes a user is allowed access to their LAN.
   * A value of 0 will allow LAN access until the next WARP reconnection, such as a
   * reboot or a laptop waking from sleep. Note that this field is omitted from the
   * response if null or unset.
   */
  lan_allow_minutes?: number;

  /**
   * Body param: The size of the subnet for the local access network. Note that this
   * field is omitted from the response if null or unset.
   */
  lan_allow_subnet_size?: number;

  /**
   * Body param: Determines if the operating system will register WARP's local
   * interface IP with your on-premises DNS server.
   */
  register_interface_ip_with_dns?: boolean;

  /**
   * Body param: Determines whether the WARP client indicates to SCCM that it is
   * inside a VPN boundary. (Windows only).
   */
  sccm_vpn_boundary_support?: boolean;

  /**
   * Body param:
   */
  service_mode_v2?: DefaultEditParams.ServiceModeV2;

  /**
   * Body param: The URL to launch when the Send Feedback button is clicked.
   */
  support_url?: string;

  /**
   * Body param: Whether to allow the user to turn off the WARP switch and disconnect
   * the client.
   */
  switch_locked?: boolean;

  /**
   * Body param: Determines which tunnel protocol to use.
   */
  tunnel_protocol?: string;
}

export namespace DefaultEditParams {
  export interface ServiceModeV2 {
    /**
     * The mode to run the WARP client under.
     */
    mode?: string;

    /**
     * The port number when used with proxy mode.
     */
    port?: number;
  }
}

export interface DefaultGetParams {
  account_id: string;
}

Default.Excludes = Excludes;
Default.Includes = Includes;
Default.FallbackDomains = FallbackDomains;
Default.Certificates = Certificates;

export declare namespace Default {
  export {
    type DefaultEditResponse as DefaultEditResponse,
    type DefaultGetResponse as DefaultGetResponse,
    type DefaultEditParams as DefaultEditParams,
    type DefaultGetParams as DefaultGetParams,
  };

  export {
    Excludes as Excludes,
    type ExcludeUpdateParams as ExcludeUpdateParams,
    type ExcludeGetParams as ExcludeGetParams,
  };

  export {
    Includes as Includes,
    type IncludeUpdateParams as IncludeUpdateParams,
    type IncludeGetParams as IncludeGetParams,
  };

  export {
    FallbackDomains as FallbackDomains,
    type FallbackDomainUpdateParams as FallbackDomainUpdateParams,
    type FallbackDomainGetParams as FallbackDomainGetParams,
  };

  export {
    Certificates as Certificates,
    type CertificateEditParams as CertificateEditParams,
    type CertificateGetParams as CertificateGetParams,
  };
}
