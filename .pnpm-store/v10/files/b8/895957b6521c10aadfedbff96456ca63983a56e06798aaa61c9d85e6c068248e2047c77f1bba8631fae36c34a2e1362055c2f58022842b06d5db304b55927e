// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as ACLsAPI from './acls';
import {
  ACL,
  ACLConfiguration,
  ACLCreateParams,
  ACLDeleteParams,
  ACLEditParams,
  ACLGetParams,
  ACLListParams,
  ACLUpdateParams,
  ACLs,
  ACLsSinglePage,
  AllowedProtocol,
  Subnet,
} from './acls';
import * as LANsAPI from './lans';
import {
  DHCPRelay,
  DHCPServer,
  LAN,
  LANCreateParams,
  LANDeleteParams,
  LANEditParams,
  LANGetParams,
  LANListParams,
  LANStaticAddressing,
  LANUpdateParams,
  LANs,
  LANsSinglePage,
  Nat,
  RoutedSubnet,
} from './lans';
import * as WANsAPI from './wans';
import {
  WAN,
  WANCreateParams,
  WANDeleteParams,
  WANEditParams,
  WANGetParams,
  WANListParams,
  WANStaticAddressing,
  WANUpdateParams,
  WANs,
  WANsSinglePage,
} from './wans';
import { SinglePage } from '../../../pagination';

export class Sites extends APIResource {
  acls: ACLsAPI.ACLs = new ACLsAPI.ACLs(this._client);
  lans: LANsAPI.LANs = new LANsAPI.LANs(this._client);
  wans: WANsAPI.WANs = new WANsAPI.WANs(this._client);

  /**
   * Creates a new Site
   *
   * @example
   * ```ts
   * const site = await client.magicTransit.sites.create({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   name: 'site_1',
   * });
   * ```
   */
  create(params: SiteCreateParams, options?: Core.RequestOptions): Core.APIPromise<Site> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/magic/sites`, { body, ...options }) as Core.APIPromise<{
        result: Site;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update a specific Site.
   *
   * @example
   * ```ts
   * const site = await client.magicTransit.sites.update(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  update(siteId: string, params: SiteUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Site> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/magic/sites/${siteId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Site }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists Sites associated with an account. Use connectorid query param to return
   * sites where connectorid matches either site.ConnectorID or
   * site.SecondaryConnectorID.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const site of client.magicTransit.sites.list({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * })) {
   *   // ...
   * }
   * ```
   */
  list(params: SiteListParams, options?: Core.RequestOptions): Core.PagePromise<SitesSinglePage, Site> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(`/accounts/${account_id}/magic/sites`, SitesSinglePage, {
      query,
      ...options,
    });
  }

  /**
   * Remove a specific Site.
   *
   * @example
   * ```ts
   * const site = await client.magicTransit.sites.delete(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(siteId: string, params: SiteDeleteParams, options?: Core.RequestOptions): Core.APIPromise<Site> {
    const { account_id } = params;
    return (
      this._client.delete(`/accounts/${account_id}/magic/sites/${siteId}`, options) as Core.APIPromise<{
        result: Site;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Patch a specific Site.
   *
   * @example
   * ```ts
   * const site = await client.magicTransit.sites.edit(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  edit(siteId: string, params: SiteEditParams, options?: Core.RequestOptions): Core.APIPromise<Site> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/magic/sites/${siteId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Site }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get a specific Site.
   *
   * @example
   * ```ts
   * const site = await client.magicTransit.sites.get(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(siteId: string, params: SiteGetParams, options?: Core.RequestOptions): Core.APIPromise<Site> {
    const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget } = params;
    return (
      this._client.get(`/accounts/${account_id}/magic/sites/${siteId}`, {
        ...options,
        headers: {
          ...(xMagicNewHcTarget?.toString() != null ?
            { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: Site }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class SitesSinglePage extends SinglePage<Site> {}

export interface Site {
  /**
   * Identifier
   */
  id?: string;

  /**
   * Magic Connector identifier tag.
   */
  connector_id?: string;

  description?: string;

  /**
   * Site high availability mode. If set to true, the site can have two connectors
   * and runs in high availability mode.
   */
  ha_mode?: boolean;

  /**
   * Location of site in latitude and longitude.
   */
  location?: SiteLocation;

  /**
   * The name of the site.
   */
  name?: string;

  /**
   * Magic Connector identifier tag. Used when high availability mode is on.
   */
  secondary_connector_id?: string;
}

/**
 * Location of site in latitude and longitude.
 */
export interface SiteLocation {
  /**
   * Latitude
   */
  lat?: string;

  /**
   * Longitude
   */
  lon?: string;
}

/**
 * Location of site in latitude and longitude.
 */
export interface SiteLocationParam {
  /**
   * Latitude
   */
  lat?: string;

  /**
   * Longitude
   */
  lon?: string;
}

export interface SiteCreateParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Body param: The name of the site.
   */
  name: string;

  /**
   * Body param: Magic Connector identifier tag.
   */
  connector_id?: string;

  /**
   * Body param:
   */
  description?: string;

  /**
   * Body param: Site high availability mode. If set to true, the site can have two
   * connectors and runs in high availability mode.
   */
  ha_mode?: boolean;

  /**
   * Body param: Location of site in latitude and longitude.
   */
  location?: SiteLocationParam;

  /**
   * Body param: Magic Connector identifier tag. Used when high availability mode is
   * on.
   */
  secondary_connector_id?: string;
}

export interface SiteUpdateParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Body param: Magic Connector identifier tag.
   */
  connector_id?: string;

  /**
   * Body param:
   */
  description?: string;

  /**
   * Body param: Location of site in latitude and longitude.
   */
  location?: SiteLocationParam;

  /**
   * Body param: The name of the site.
   */
  name?: string;

  /**
   * Body param: Magic Connector identifier tag. Used when high availability mode is
   * on.
   */
  secondary_connector_id?: string;
}

export interface SiteListParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Query param: Identifier
   */
  connectorid?: string;
}

export interface SiteDeleteParams {
  /**
   * Identifier
   */
  account_id: string;
}

export interface SiteEditParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Body param: Magic Connector identifier tag.
   */
  connector_id?: string;

  /**
   * Body param:
   */
  description?: string;

  /**
   * Body param: Location of site in latitude and longitude.
   */
  location?: SiteLocationParam;

  /**
   * Body param: The name of the site.
   */
  name?: string;

  /**
   * Body param: Magic Connector identifier tag. Used when high availability mode is
   * on.
   */
  secondary_connector_id?: string;
}

export interface SiteGetParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Header param: If true, the health check target in the response body will be
   * presented using the new object format. Defaults to false.
   */
  'x-magic-new-hc-target'?: boolean;
}

Sites.SitesSinglePage = SitesSinglePage;
Sites.ACLs = ACLs;
Sites.ACLsSinglePage = ACLsSinglePage;
Sites.LANs = LANs;
Sites.LANsSinglePage = LANsSinglePage;
Sites.WANs = WANs;
Sites.WANsSinglePage = WANsSinglePage;

export declare namespace Sites {
  export {
    type Site as Site,
    type SiteLocation as SiteLocation,
    SitesSinglePage as SitesSinglePage,
    type SiteCreateParams as SiteCreateParams,
    type SiteUpdateParams as SiteUpdateParams,
    type SiteListParams as SiteListParams,
    type SiteDeleteParams as SiteDeleteParams,
    type SiteEditParams as SiteEditParams,
    type SiteGetParams as SiteGetParams,
  };

  export {
    ACLs as ACLs,
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

  export {
    LANs as LANs,
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

  export {
    WANs as WANs,
    type WAN as WAN,
    type WANStaticAddressing as WANStaticAddressing,
    WANsSinglePage as WANsSinglePage,
    type WANCreateParams as WANCreateParams,
    type WANUpdateParams as WANUpdateParams,
    type WANListParams as WANListParams,
    type WANDeleteParams as WANDeleteParams,
    type WANEditParams as WANEditParams,
    type WANGetParams as WANGetParams,
  };
}
