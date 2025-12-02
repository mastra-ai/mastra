import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as ACLsAPI from "./acls.js";
import { ACL, ACLConfiguration, ACLCreateParams, ACLDeleteParams, ACLEditParams, ACLGetParams, ACLListParams, ACLUpdateParams, ACLs, ACLsSinglePage, AllowedProtocol, Subnet } from "./acls.js";
import * as LANsAPI from "./lans.js";
import { DHCPRelay, DHCPServer, LAN, LANCreateParams, LANDeleteParams, LANEditParams, LANGetParams, LANListParams, LANStaticAddressing, LANUpdateParams, LANs, LANsSinglePage, Nat, RoutedSubnet } from "./lans.js";
import * as WANsAPI from "./wans.js";
import { WAN, WANCreateParams, WANDeleteParams, WANEditParams, WANGetParams, WANListParams, WANStaticAddressing, WANUpdateParams, WANs, WANsSinglePage } from "./wans.js";
import { SinglePage } from "../../../pagination.js";
export declare class Sites extends APIResource {
    acls: ACLsAPI.ACLs;
    lans: LANsAPI.LANs;
    wans: WANsAPI.WANs;
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
    create(params: SiteCreateParams, options?: Core.RequestOptions): Core.APIPromise<Site>;
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
    update(siteId: string, params: SiteUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Site>;
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
    list(params: SiteListParams, options?: Core.RequestOptions): Core.PagePromise<SitesSinglePage, Site>;
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
    delete(siteId: string, params: SiteDeleteParams, options?: Core.RequestOptions): Core.APIPromise<Site>;
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
    edit(siteId: string, params: SiteEditParams, options?: Core.RequestOptions): Core.APIPromise<Site>;
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
    get(siteId: string, params: SiteGetParams, options?: Core.RequestOptions): Core.APIPromise<Site>;
}
export declare class SitesSinglePage extends SinglePage<Site> {
}
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
export declare namespace Sites {
    export { type Site as Site, type SiteLocation as SiteLocation, SitesSinglePage as SitesSinglePage, type SiteCreateParams as SiteCreateParams, type SiteUpdateParams as SiteUpdateParams, type SiteListParams as SiteListParams, type SiteDeleteParams as SiteDeleteParams, type SiteEditParams as SiteEditParams, type SiteGetParams as SiteGetParams, };
    export { ACLs as ACLs, type ACL as ACL, type ACLConfiguration as ACLConfiguration, type AllowedProtocol as AllowedProtocol, type Subnet as Subnet, ACLsSinglePage as ACLsSinglePage, type ACLCreateParams as ACLCreateParams, type ACLUpdateParams as ACLUpdateParams, type ACLListParams as ACLListParams, type ACLDeleteParams as ACLDeleteParams, type ACLEditParams as ACLEditParams, type ACLGetParams as ACLGetParams, };
    export { LANs as LANs, type DHCPRelay as DHCPRelay, type DHCPServer as DHCPServer, type LAN as LAN, type LANStaticAddressing as LANStaticAddressing, type Nat as Nat, type RoutedSubnet as RoutedSubnet, LANsSinglePage as LANsSinglePage, type LANCreateParams as LANCreateParams, type LANUpdateParams as LANUpdateParams, type LANListParams as LANListParams, type LANDeleteParams as LANDeleteParams, type LANEditParams as LANEditParams, type LANGetParams as LANGetParams, };
    export { WANs as WANs, type WAN as WAN, type WANStaticAddressing as WANStaticAddressing, WANsSinglePage as WANsSinglePage, type WANCreateParams as WANCreateParams, type WANUpdateParams as WANUpdateParams, type WANListParams as WANListParams, type WANDeleteParams as WANDeleteParams, type WANEditParams as WANEditParams, type WANGetParams as WANGetParams, };
}
//# sourceMappingURL=sites.d.ts.map