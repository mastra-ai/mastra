// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../../resource';
import * as Core from '../../../../../core';
import * as PoliciesAPI from '../policies';
import { SettingsPoliciesSinglePage } from '../policies';
import * as ExcludesAPI from './excludes';
import { ExcludeGetParams, ExcludeUpdateParams, Excludes } from './excludes';
import * as FallbackDomainsAPI from './fallback-domains';
import { FallbackDomainGetParams, FallbackDomainUpdateParams, FallbackDomains } from './fallback-domains';
import * as IncludesAPI from './includes';
import { IncludeGetParams, IncludeUpdateParams, Includes } from './includes';

export class Custom extends APIResource {
  excludes: ExcludesAPI.Excludes = new ExcludesAPI.Excludes(this._client);
  includes: IncludesAPI.Includes = new IncludesAPI.Includes(this._client);
  fallbackDomains: FallbackDomainsAPI.FallbackDomains = new FallbackDomainsAPI.FallbackDomains(this._client);

  /**
   * Creates a device settings profile to be applied to certain devices matching the
   * criteria.
   *
   * @example
   * ```ts
   * const settingsPolicy =
   *   await client.zeroTrust.devices.policies.custom.create({
   *     account_id: '699d98642c564d2e855e9661899b7252',
   *     match: 'identity.email == "test@cloudflare.com"',
   *     name: 'Allow Developers',
   *     precedence: 100,
   *   });
   * ```
   */
  create(
    params: CustomCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PoliciesAPI.SettingsPolicy | null> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/devices/policy`, { body, ...options }) as Core.APIPromise<{
        result: PoliciesAPI.SettingsPolicy | null;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches a list of the device settings profiles for an account.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const settingsPolicy of client.zeroTrust.devices.policies.custom.list(
   *   { account_id: '699d98642c564d2e855e9661899b7252' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: CustomListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<SettingsPoliciesSinglePage, PoliciesAPI.SettingsPolicy> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/devices/policies`,
      SettingsPoliciesSinglePage,
      options,
    );
  }

  /**
   * Deletes a device settings profile and fetches a list of the remaining profiles
   * for an account.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const settingsPolicy of client.zeroTrust.devices.policies.custom.delete(
   *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *   { account_id: '699d98642c564d2e855e9661899b7252' },
   * )) {
   *   // ...
   * }
   * ```
   */
  delete(
    policyId: string,
    params: CustomDeleteParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<SettingsPoliciesSinglePage, PoliciesAPI.SettingsPolicy> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/devices/policy/${policyId}`,
      SettingsPoliciesSinglePage,
      { method: 'delete', ...options },
    );
  }

  /**
   * Updates a configured device settings profile.
   *
   * @example
   * ```ts
   * const settingsPolicy =
   *   await client.zeroTrust.devices.policies.custom.edit(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '699d98642c564d2e855e9661899b7252' },
   *   );
   * ```
   */
  edit(
    policyId: string,
    params: CustomEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PoliciesAPI.SettingsPolicy | null> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/devices/policy/${policyId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: PoliciesAPI.SettingsPolicy | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches a device settings profile by ID.
   *
   * @example
   * ```ts
   * const settingsPolicy =
   *   await client.zeroTrust.devices.policies.custom.get(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '699d98642c564d2e855e9661899b7252' },
   *   );
   * ```
   */
  get(
    policyId: string,
    params: CustomGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PoliciesAPI.SettingsPolicy | null> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/devices/policy/${policyId}`, options) as Core.APIPromise<{
        result: PoliciesAPI.SettingsPolicy | null;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface CustomCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: The wirefilter expression to match devices. Available values:
   * "identity.email", "identity.groups.id", "identity.groups.name",
   * "identity.groups.email", "identity.service_token_uuid",
   * "identity.saml_attributes", "network", "os.name", "os.version".
   */
  match: string;

  /**
   * Body param: The name of the device settings profile.
   */
  name: string;

  /**
   * Body param: The precedence of the policy. Lower values indicate higher
   * precedence. Policies will be evaluated in ascending order of this field.
   */
  precedence: number;

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
   * Body param: A description of the policy.
   */
  description?: string;

  /**
   * Body param: If the `dns_server` field of a fallback domain is not present, the
   * client will fall back to a best guess of the default/system DNS resolvers unless
   * this policy option is set to `true`.
   */
  disable_auto_fallback?: boolean;

  /**
   * Body param: Whether the policy will be applied to matching devices.
   */
  enabled?: boolean;

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
  service_mode_v2?: CustomCreateParams.ServiceModeV2;

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

export namespace CustomCreateParams {
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

export interface CustomListParams {
  account_id: string;
}

export interface CustomDeleteParams {
  account_id: string;
}

export interface CustomEditParams {
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
   * Body param: A description of the policy.
   */
  description?: string;

  /**
   * Body param: If the `dns_server` field of a fallback domain is not present, the
   * client will fall back to a best guess of the default/system DNS resolvers unless
   * this policy option is set to `true`.
   */
  disable_auto_fallback?: boolean;

  /**
   * Body param: Whether the policy will be applied to matching devices.
   */
  enabled?: boolean;

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
   * Body param: The wirefilter expression to match devices. Available values:
   * "identity.email", "identity.groups.id", "identity.groups.name",
   * "identity.groups.email", "identity.service_token_uuid",
   * "identity.saml_attributes", "network", "os.name", "os.version".
   */
  match?: string;

  /**
   * Body param: The name of the device settings profile.
   */
  name?: string;

  /**
   * Body param: The precedence of the policy. Lower values indicate higher
   * precedence. Policies will be evaluated in ascending order of this field.
   */
  precedence?: number;

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
  service_mode_v2?: CustomEditParams.ServiceModeV2;

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

export namespace CustomEditParams {
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

export interface CustomGetParams {
  account_id: string;
}

Custom.Excludes = Excludes;
Custom.Includes = Includes;
Custom.FallbackDomains = FallbackDomains;

export declare namespace Custom {
  export {
    type CustomCreateParams as CustomCreateParams,
    type CustomListParams as CustomListParams,
    type CustomDeleteParams as CustomDeleteParams,
    type CustomEditParams as CustomEditParams,
    type CustomGetParams as CustomGetParams,
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
}

export { SettingsPoliciesSinglePage };
