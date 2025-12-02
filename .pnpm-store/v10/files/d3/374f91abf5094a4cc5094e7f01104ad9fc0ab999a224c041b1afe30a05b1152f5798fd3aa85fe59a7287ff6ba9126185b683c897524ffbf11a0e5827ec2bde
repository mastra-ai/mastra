// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class ACLs extends APIResource {
  /**
   * Creates a new Site ACL.
   *
   * @example
   * ```ts
   * const acl = await client.magicTransit.sites.acls.create(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     lan_1: { lan_id: 'lan_id' },
   *     lan_2: { lan_id: 'lan_id' },
   *     name: 'PIN Pad - Cash Register',
   *   },
   * );
   * ```
   */
  create(siteId: string, params: ACLCreateParams, options?: Core.RequestOptions): Core.APIPromise<ACL> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/magic/sites/${siteId}/acls`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ACL }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update a specific Site ACL.
   *
   * @example
   * ```ts
   * const acl = await client.magicTransit.sites.acls.update(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  update(
    siteId: string,
    aclId: string,
    params: ACLUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ACL> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/magic/sites/${siteId}/acls/${aclId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ACL }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists Site ACLs associated with an account.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const acl of client.magicTransit.sites.acls.list(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    siteId: string,
    params: ACLListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<ACLsSinglePage, ACL> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/magic/sites/${siteId}/acls`,
      ACLsSinglePage,
      options,
    );
  }

  /**
   * Remove a specific Site ACL.
   *
   * @example
   * ```ts
   * const acl = await client.magicTransit.sites.acls.delete(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    siteId: string,
    aclId: string,
    params: ACLDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ACL> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/magic/sites/${siteId}/acls/${aclId}`,
        options,
      ) as Core.APIPromise<{ result: ACL }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Patch a specific Site ACL.
   *
   * @example
   * ```ts
   * const acl = await client.magicTransit.sites.acls.edit(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  edit(
    siteId: string,
    aclId: string,
    params: ACLEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ACL> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/magic/sites/${siteId}/acls/${aclId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ACL }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get a specific Site ACL.
   *
   * @example
   * ```ts
   * const acl = await client.magicTransit.sites.acls.get(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    siteId: string,
    aclId: string,
    params: ACLGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ACL> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/magic/sites/${siteId}/acls/${aclId}`,
        options,
      ) as Core.APIPromise<{ result: ACL }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class ACLsSinglePage extends SinglePage<ACL> {}

/**
 * Bidirectional ACL policy for network traffic within a site.
 */
export interface ACL {
  /**
   * Identifier
   */
  id?: string;

  /**
   * Description for the ACL.
   */
  description?: string;

  /**
   * The desired forwarding action for this ACL policy. If set to "false", the policy
   * will forward traffic to Cloudflare. If set to "true", the policy will forward
   * traffic locally on the Magic Connector. If not included in request, will default
   * to false.
   */
  forward_locally?: boolean;

  lan_1?: ACLConfiguration;

  lan_2?: ACLConfiguration;

  /**
   * The name of the ACL.
   */
  name?: string;

  protocols?: Array<AllowedProtocol>;

  /**
   * The desired traffic direction for this ACL policy. If set to "false", the policy
   * will allow bidirectional traffic. If set to "true", the policy will only allow
   * traffic in one direction. If not included in request, will default to false.
   */
  unidirectional?: boolean;
}

export interface ACLConfiguration {
  /**
   * The identifier for the LAN you want to create an ACL policy with.
   */
  lan_id: string;

  /**
   * The name of the LAN based on the provided lan_id.
   */
  lan_name?: string;

  /**
   * Array of port ranges on the provided LAN that will be included in the ACL. If no
   * ports or port rangess are provided, communication on any port on this LAN is
   * allowed.
   */
  port_ranges?: Array<string>;

  /**
   * Array of ports on the provided LAN that will be included in the ACL. If no ports
   * or port ranges are provided, communication on any port on this LAN is allowed.
   */
  ports?: Array<number>;

  /**
   * Array of subnet IPs within the LAN that will be included in the ACL. If no
   * subnets are provided, communication on any subnets on this LAN are allowed.
   */
  subnets?: Array<Subnet>;
}

export interface ACLConfigurationParam {
  /**
   * The identifier for the LAN you want to create an ACL policy with.
   */
  lan_id: string;

  /**
   * The name of the LAN based on the provided lan_id.
   */
  lan_name?: string;

  /**
   * Array of port ranges on the provided LAN that will be included in the ACL. If no
   * ports or port rangess are provided, communication on any port on this LAN is
   * allowed.
   */
  port_ranges?: Array<string>;

  /**
   * Array of ports on the provided LAN that will be included in the ACL. If no ports
   * or port ranges are provided, communication on any port on this LAN is allowed.
   */
  ports?: Array<number>;

  /**
   * Array of subnet IPs within the LAN that will be included in the ACL. If no
   * subnets are provided, communication on any subnets on this LAN are allowed.
   */
  subnets?: Array<SubnetParam>;
}

/**
 * Array of allowed communication protocols between configured LANs. If no
 * protocols are provided, all protocols are allowed.
 */
export type AllowedProtocol = 'tcp' | 'udp' | 'icmp';

/**
 * Array of allowed communication protocols between configured LANs. If no
 * protocols are provided, all protocols are allowed.
 */
export type AllowedProtocolParam = 'tcp' | 'udp' | 'icmp';

/**
 * A valid IPv4 address.
 */
export type Subnet = string;

/**
 * A valid IPv4 address.
 */
export type SubnetParam = string;

export interface ACLCreateParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Body param:
   */
  lan_1: ACLConfigurationParam;

  /**
   * Body param:
   */
  lan_2: ACLConfigurationParam;

  /**
   * Body param: The name of the ACL.
   */
  name: string;

  /**
   * Body param: Description for the ACL.
   */
  description?: string;

  /**
   * Body param: The desired forwarding action for this ACL policy. If set to
   * "false", the policy will forward traffic to Cloudflare. If set to "true", the
   * policy will forward traffic locally on the Magic Connector. If not included in
   * request, will default to false.
   */
  forward_locally?: boolean;

  /**
   * Body param:
   */
  protocols?: Array<AllowedProtocolParam>;

  /**
   * Body param: The desired traffic direction for this ACL policy. If set to
   * "false", the policy will allow bidirectional traffic. If set to "true", the
   * policy will only allow traffic in one direction. If not included in request,
   * will default to false.
   */
  unidirectional?: boolean;
}

export interface ACLUpdateParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Body param: Description for the ACL.
   */
  description?: string;

  /**
   * Body param: The desired forwarding action for this ACL policy. If set to
   * "false", the policy will forward traffic to Cloudflare. If set to "true", the
   * policy will forward traffic locally on the Magic Connector. If not included in
   * request, will default to false.
   */
  forward_locally?: boolean;

  /**
   * Body param:
   */
  lan_1?: ACLConfigurationParam;

  /**
   * Body param:
   */
  lan_2?: ACLConfigurationParam;

  /**
   * Body param: The name of the ACL.
   */
  name?: string;

  /**
   * Body param:
   */
  protocols?: Array<AllowedProtocolParam>;

  /**
   * Body param: The desired traffic direction for this ACL policy. If set to
   * "false", the policy will allow bidirectional traffic. If set to "true", the
   * policy will only allow traffic in one direction. If not included in request,
   * will default to false.
   */
  unidirectional?: boolean;
}

export interface ACLListParams {
  /**
   * Identifier
   */
  account_id: string;
}

export interface ACLDeleteParams {
  /**
   * Identifier
   */
  account_id: string;
}

export interface ACLEditParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Body param: Description for the ACL.
   */
  description?: string;

  /**
   * Body param: The desired forwarding action for this ACL policy. If set to
   * "false", the policy will forward traffic to Cloudflare. If set to "true", the
   * policy will forward traffic locally on the Magic Connector. If not included in
   * request, will default to false.
   */
  forward_locally?: boolean;

  /**
   * Body param:
   */
  lan_1?: ACLConfigurationParam;

  /**
   * Body param:
   */
  lan_2?: ACLConfigurationParam;

  /**
   * Body param: The name of the ACL.
   */
  name?: string;

  /**
   * Body param:
   */
  protocols?: Array<AllowedProtocolParam>;

  /**
   * Body param: The desired traffic direction for this ACL policy. If set to
   * "false", the policy will allow bidirectional traffic. If set to "true", the
   * policy will only allow traffic in one direction. If not included in request,
   * will default to false.
   */
  unidirectional?: boolean;
}

export interface ACLGetParams {
  /**
   * Identifier
   */
  account_id: string;
}

ACLs.ACLsSinglePage = ACLsSinglePage;

export declare namespace ACLs {
  export {
    type ACL as ACL,
    type ACLConfiguration as ACLConfiguration,
    type AllowedProtocol as AllowedProtocol,
    type Subnet as Subnet,
    ACLsSinglePage as ACLsSinglePage,
    type ACLCreateParams as ACLCreateParams,
    type ACLUpdateParams as ACLUpdateParams,
    type ACLListParams as ACLListParams,
    type ACLDeleteParams as ACLDeleteParams,
    type ACLEditParams as ACLEditParams,
    type ACLGetParams as ACLGetParams,
  };
}
