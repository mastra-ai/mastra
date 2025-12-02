import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class WANs extends APIResource {
    /**
     * Creates a new Site WAN.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const wan of client.magicTransit.sites.wans.create(
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
    create(siteId: string, params: WANCreateParams, options?: Core.RequestOptions): Core.PagePromise<WANsSinglePage, WAN>;
    /**
     * Update a specific Site WAN.
     *
     * @example
     * ```ts
     * const wan = await client.magicTransit.sites.wans.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(siteId: string, wanId: string, params: WANUpdateParams, options?: Core.RequestOptions): Core.APIPromise<WAN>;
    /**
     * Lists Site WANs associated with an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const wan of client.magicTransit.sites.wans.list(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(siteId: string, params: WANListParams, options?: Core.RequestOptions): Core.PagePromise<WANsSinglePage, WAN>;
    /**
     * Remove a specific Site WAN.
     *
     * @example
     * ```ts
     * const wan = await client.magicTransit.sites.wans.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(siteId: string, wanId: string, params: WANDeleteParams, options?: Core.RequestOptions): Core.APIPromise<WAN>;
    /**
     * Patch a specific Site WAN.
     *
     * @example
     * ```ts
     * const wan = await client.magicTransit.sites.wans.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(siteId: string, wanId: string, params: WANEditParams, options?: Core.RequestOptions): Core.APIPromise<WAN>;
    /**
     * Get a specific Site WAN.
     *
     * @example
     * ```ts
     * const wan = await client.magicTransit.sites.wans.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(siteId: string, wanId: string, params: WANGetParams, options?: Core.RequestOptions): Core.APIPromise<WAN>;
}
export declare class WANsSinglePage extends SinglePage<WAN> {
}
export interface WAN {
    /**
     * Identifier
     */
    id?: string;
    /**
     * Magic WAN health check rate for tunnels created on this link. The default value
     * is `mid`.
     */
    health_check_rate?: 'low' | 'mid' | 'high';
    name?: string;
    physport?: number;
    /**
     * Priority of WAN for traffic loadbalancing.
     */
    priority?: number;
    /**
     * Identifier
     */
    site_id?: string;
    /**
     * (optional) if omitted, use DHCP. Submit secondary_address when site is in high
     * availability mode.
     */
    static_addressing?: WANStaticAddressing;
    /**
     * VLAN ID. Use zero for untagged.
     */
    vlan_tag?: number;
}
/**
 * (optional) if omitted, use DHCP. Submit secondary_address when site is in high
 * availability mode.
 */
export interface WANStaticAddressing {
    /**
     * A valid CIDR notation representing an IP range.
     */
    address: string;
    /**
     * A valid IPv4 address.
     */
    gateway_address: string;
    /**
     * A valid CIDR notation representing an IP range.
     */
    secondary_address?: string;
}
/**
 * (optional) if omitted, use DHCP. Submit secondary_address when site is in high
 * availability mode.
 */
export interface WANStaticAddressingParam {
    /**
     * A valid CIDR notation representing an IP range.
     */
    address: string;
    /**
     * A valid IPv4 address.
     */
    gateway_address: string;
    /**
     * A valid CIDR notation representing an IP range.
     */
    secondary_address?: string;
}
export interface WANCreateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param:
     */
    physport: number;
    /**
     * Body param:
     */
    name?: string;
    /**
     * Body param:
     */
    priority?: number;
    /**
     * Body param: (optional) if omitted, use DHCP. Submit secondary_address when site
     * is in high availability mode.
     */
    static_addressing?: WANStaticAddressingParam;
    /**
     * Body param: VLAN ID. Use zero for untagged.
     */
    vlan_tag?: number;
}
export interface WANUpdateParams {
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
    physport?: number;
    /**
     * Body param:
     */
    priority?: number;
    /**
     * Body param: (optional) if omitted, use DHCP. Submit secondary_address when site
     * is in high availability mode.
     */
    static_addressing?: WANStaticAddressingParam;
    /**
     * Body param: VLAN ID. Use zero for untagged.
     */
    vlan_tag?: number;
}
export interface WANListParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface WANDeleteParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface WANEditParams {
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
    physport?: number;
    /**
     * Body param:
     */
    priority?: number;
    /**
     * Body param: (optional) if omitted, use DHCP. Submit secondary_address when site
     * is in high availability mode.
     */
    static_addressing?: WANStaticAddressingParam;
    /**
     * Body param: VLAN ID. Use zero for untagged.
     */
    vlan_tag?: number;
}
export interface WANGetParams {
    /**
     * Identifier
     */
    account_id: string;
}
export declare namespace WANs {
    export { type WAN as WAN, type WANStaticAddressing as WANStaticAddressing, WANsSinglePage as WANsSinglePage, type WANCreateParams as WANCreateParams, type WANUpdateParams as WANUpdateParams, type WANListParams as WANListParams, type WANDeleteParams as WANDeleteParams, type WANEditParams as WANEditParams, type WANGetParams as WANGetParams, };
}
//# sourceMappingURL=wans.d.ts.map