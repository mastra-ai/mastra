// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class LANs extends APIResource {
  /**
   * Creates a new Site LAN. If the site is in high availability mode,
   * static_addressing is required along with secondary and virtual address.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const lan of client.magicTransit.sites.lans.create(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     physport: 1,
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  create(
    siteId: string,
    params: LANCreateParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<LANsSinglePage, LAN> {
    const { account_id, ...body } = params;
    return this._client.getAPIList(`/accounts/${account_id}/magic/sites/${siteId}/lans`, LANsSinglePage, {
      body,
      method: 'post',
      ...options,
    });
  }

  /**
   * Update a specific Site LAN.
   *
   * @example
   * ```ts
   * const lan = await client.magicTransit.sites.lans.update(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  update(
    siteId: string,
    lanId: string,
    params: LANUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LAN> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/magic/sites/${siteId}/lans/${lanId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: LAN }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists Site LANs associated with an account.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const lan of client.magicTransit.sites.lans.list(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    siteId: string,
    params: LANListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<LANsSinglePage, LAN> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/magic/sites/${siteId}/lans`,
      LANsSinglePage,
      options,
    );
  }

  /**
   * Remove a specific Site LAN.
   *
   * @example
   * ```ts
   * const lan = await client.magicTransit.sites.lans.delete(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    siteId: string,
    lanId: string,
    params: LANDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LAN> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/magic/sites/${siteId}/lans/${lanId}`,
        options,
      ) as Core.APIPromise<{ result: LAN }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Patch a specific Site LAN.
   *
   * @example
   * ```ts
   * const lan = await client.magicTransit.sites.lans.edit(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  edit(
    siteId: string,
    lanId: string,
    params: LANEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LAN> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/magic/sites/${siteId}/lans/${lanId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: LAN }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get a specific Site LAN.
   *
   * @example
   * ```ts
   * const lan = await client.magicTransit.sites.lans.get(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    siteId: string,
    lanId: string,
    params: LANGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LAN> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/magic/sites/${siteId}/lans/${lanId}`,
        options,
      ) as Core.APIPromise<{ result: LAN }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class LANsSinglePage extends SinglePage<LAN> {}

export interface DHCPRelay {
  /**
   * List of DHCP server IPs.
   */
  server_addresses?: Array<string>;
}

export interface DHCPRelayParam {
  /**
   * List of DHCP server IPs.
   */
  server_addresses?: Array<string>;
}

export interface DHCPServer {
  /**
   * A valid IPv4 address.
   */
  dhcp_pool_end?: string;

  /**
   * A valid IPv4 address.
   */
  dhcp_pool_start?: string;

  /**
   * A valid IPv4 address.
   */
  dns_server?: string;

  dns_servers?: Array<string>;

  /**
   * Mapping of MAC addresses to IP addresses
   */
  reservations?: { [key: string]: string };
}

export interface DHCPServerParam {
  /**
   * A valid IPv4 address.
   */
  dhcp_pool_end?: string;

  /**
   * A valid IPv4 address.
   */
  dhcp_pool_start?: string;

  /**
   * A valid IPv4 address.
   */
  dns_server?: string;

  dns_servers?: Array<string>;

  /**
   * Mapping of MAC addresses to IP addresses
   */
  reservations?: { [key: string]: string };
}

export interface LAN {
  /**
   * Identifier
   */
  id?: string;

  /**
   * mark true to use this LAN for HA probing. only works for site with HA turned on.
   * only one LAN can be set as the ha_link.
   */
  ha_link?: boolean;

  name?: string;

  nat?: Nat;

  physport?: number;

  routed_subnets?: Array<RoutedSubnet>;

  /**
   * Identifier
   */
  site_id?: string;

  /**
   * If the site is not configured in high availability mode, this configuration is
   * optional (if omitted, use DHCP). However, if in high availability mode,
   * static_address is required along with secondary and virtual address.
   */
  static_addressing?: LANStaticAddressing;

  /**
   * VLAN ID. Use zero for untagged.
   */
  vlan_tag?: number;
}

/**
 * If the site is not configured in high availability mode, this configuration is
 * optional (if omitted, use DHCP). However, if in high availability mode,
 * static_address is required along with secondary and virtual address.
 */
export interface LANStaticAddressing {
  /**
   * A valid CIDR notation representing an IP range.
   */
  address: string;

  dhcp_relay?: DHCPRelay;

  dhcp_server?: DHCPServer;

  /**
   * A valid CIDR notation representing an IP range.
   */
  secondary_address?: string;

  /**
   * A valid CIDR notation representing an IP range.
   */
  virtual_address?: string;
}

/**
 * If the site is not configured in high availability mode, this configuration is
 * optional (if omitted, use DHCP). However, if in high availability mode,
 * static_address is required along with secondary and virtual address.
 */
export interface LANStaticAddressingParam {
  /**
   * A valid CIDR notation representing an IP range.
   */
  address: string;

  dhcp_relay?: DHCPRelayParam;

  dhcp_server?: DHCPServerParam;

  /**
   * A valid CIDR notation representing an IP range.
   */
  secondary_address?: string;

  /**
   * A valid CIDR notation representing an IP range.
   */
  virtual_address?: string;
}

export interface Nat {
  /**
   * A valid CIDR notation representing an IP range.
   */
  static_prefix?: string;
}

export interface NatParam {
  /**
   * A valid CIDR notation representing an IP range.
   */
  static_prefix?: string;
}

export interface RoutedSubnet {
  /**
   * A valid IPv4 address.
   */
  next_hop: string;

  /**
   * A valid CIDR notation representing an IP range.
   */
  prefix: string;

  nat?: Nat;
}

export interface RoutedSubnetParam {
  /**
   * A valid IPv4 address.
   */
  next_hop: string;

  /**
   * A valid CIDR notation representing an IP range.
   */
  prefix: string;

  nat?: NatParam;
}

export interface LANCreateParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Body param:
   */
  physport: number;

  /**
   * Body param: mark true to use this LAN for HA probing. only works for site with
   * HA turned on. only one LAN can be set as the ha_link.
   */
  ha_link?: boolean;

  /**
   * Body param:
   */
  name?: string;

  /**
   * Body param:
   */
  nat?: NatParam;

  /**
   * Body param:
   */
  routed_subnets?: Array<RoutedSubnetParam>;

  /**
   * Body param: If the site is not configured in high availability mode, this
   * configuration is optional (if omitted, use DHCP). However, if in high
   * availability mode, static_address is required along with secondary and virtual
   * address.
   */
  static_addressing?: LANStaticAddressingParam;

  /**
   * Body param: VLAN ID. Use zero for untagged.
   */
  vlan_tag?: number;
}

export interface LANUpdateParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Body param:
   */
  name?: string;

  /**
   * Body param:
   */
  nat?: NatParam;

  /**
   * Body param:
   */
  physport?: number;

  /**
   * Body param:
   */
  routed_subnets?: Array<RoutedSubnetParam>;

  /**
   * Body param: If the site is not configured in high availability mode, this
   * configuration is optional (if omitted, use DHCP). However, if in high
   * availability mode, static_address is required along with secondary and virtual
   * address.
   */
  static_addressing?: LANStaticAddressingParam;

  /**
   * Body param: VLAN ID. Use zero for untagged.
   */
  vlan_tag?: number;
}

export interface LANListParams {
  /**
   * Identifier
   */
  account_id: string;
}

export interface LANDeleteParams {
  /**
   * Identifier
   */
  account_id: string;
}

export interface LANEditParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Body param:
   */
  name?: string;

  /**
   * Body param:
   */
  nat?: NatParam;

  /**
   * Body param:
   */
  physport?: number;

  /**
   * Body param:
   */
  routed_subnets?: Array<RoutedSubnetParam>;

  /**
   * Body param: If the site is not configured in high availability mode, this
   * configuration is optional (if omitted, use DHCP). However, if in high
   * availability mode, static_address is required along with secondary and virtual
   * address.
   */
  static_addressing?: LANStaticAddressingParam;

  /**
   * Body param: VLAN ID. Use zero for untagged.
   */
  vlan_tag?: number;
}

export interface LANGetParams {
  /**
   * Identifier
   */
  account_id: string;
}

LANs.LANsSinglePage = LANsSinglePage;

export declare namespace LANs {
  export {
    type DHCPRelay as DHCPRelay,
    type DHCPServer as DHCPServer,
    type LAN as LAN,
    type LANStaticAddressing as LANStaticAddressing,
    type Nat as Nat,
    type RoutedSubnet as RoutedSubnet,
    LANsSinglePage as LANsSinglePage,
    type LANCreateParams as LANCreateParams,
    type LANUpdateParams as LANUpdateParams,
    type LANListParams as LANListParams,
    type LANDeleteParams as LANDeleteParams,
    type LANEditParams as LANEditParams,
    type LANGetParams as LANGetParams,
  };
}
