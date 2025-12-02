import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class BGPPrefixes extends APIResource {
    /**
     * Create a BGP prefix, controlling the BGP advertisement status of a specific
     * subnet. When created, BGP prefixes are initially withdrawn, and can be
     * advertised with the Update BGP Prefix API.
     *
     * @example
     * ```ts
     * const bgpPrefix =
     *   await client.addressing.prefixes.bgpPrefixes.create(
     *     '2af39739cc4e3b5910c918468bb89828',
     *     { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     *   );
     * ```
     */
    create(prefixId: string, params: BGPPrefixCreateParams, options?: Core.RequestOptions): Core.APIPromise<BGPPrefix>;
    /**
     * List all BGP Prefixes within the specified IP Prefix. BGP Prefixes are used to
     * control which specific subnets are advertised to the Internet. It is possible to
     * advertise subnets more specific than an IP Prefix by creating more specific BGP
     * Prefixes.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const bgpPrefix of client.addressing.prefixes.bgpPrefixes.list(
     *   '2af39739cc4e3b5910c918468bb89828',
     *   { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(prefixId: string, params: BGPPrefixListParams, options?: Core.RequestOptions): Core.PagePromise<BGPPrefixesSinglePage, BGPPrefix>;
    /**
     * Update the properties of a BGP Prefix, such as the on demand advertisement
     * status (advertised or withdrawn).
     *
     * @example
     * ```ts
     * const bgpPrefix =
     *   await client.addressing.prefixes.bgpPrefixes.edit(
     *     '2af39739cc4e3b5910c918468bb89828',
     *     '7009ba364c7a5760798ceb430e603b74',
     *     { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     *   );
     * ```
     */
    edit(prefixId: string, bgpPrefixId: string, params: BGPPrefixEditParams, options?: Core.RequestOptions): Core.APIPromise<BGPPrefix>;
    /**
     * Retrieve a single BGP Prefix according to its identifier
     *
     * @example
     * ```ts
     * const bgpPrefix =
     *   await client.addressing.prefixes.bgpPrefixes.get(
     *     '2af39739cc4e3b5910c918468bb89828',
     *     '7009ba364c7a5760798ceb430e603b74',
     *     { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     *   );
     * ```
     */
    get(prefixId: string, bgpPrefixId: string, params: BGPPrefixGetParams, options?: Core.RequestOptions): Core.APIPromise<BGPPrefix>;
}
export declare class BGPPrefixesSinglePage extends SinglePage<BGPPrefix> {
}
export interface BGPPrefix {
    /**
     * Identifier of BGP Prefix.
     */
    id?: string;
    /**
     * Autonomous System Number (ASN) the prefix will be advertised under.
     */
    asn?: number | null;
    /**
     * Number of times to prepend the Cloudflare ASN to the BGP AS-Path attribute
     */
    asn_prepend_count?: number;
    bgp_signal_opts?: BGPPrefix.BGPSignalOpts;
    /**
     * IP Prefix in Classless Inter-Domain Routing format.
     */
    cidr?: string;
    created_at?: string;
    modified_at?: string;
    on_demand?: BGPPrefix.OnDemand;
    /**
     * Controls whether the BGP prefix is automatically withdrawn when prefix is
     * withdrawn from Magic routing table (for Magic Transit customers using Direct
     * CNI)
     */
    withdraw_if_no_route?: boolean;
}
export declare namespace BGPPrefix {
    interface BGPSignalOpts {
        /**
         * Whether control of advertisement of the prefix to the Internet is enabled to be
         * performed via BGP signal
         */
        enabled?: boolean;
        /**
         * Last time BGP signaling control was toggled. This field is null if BGP signaling
         * has never been enabled.
         */
        modified_at?: string | null;
    }
    interface OnDemand {
        /**
         * Prefix advertisement status to the Internet. This field is only not 'null' if on
         * demand is enabled.
         */
        advertised?: boolean | null;
        /**
         * Last time the advertisement status was changed. This field is only not 'null' if
         * on demand is enabled.
         */
        advertised_modified_at?: string | null;
        /**
         * Whether advertisement of the prefix to the Internet may be dynamically enabled
         * or disabled.
         */
        on_demand_enabled?: boolean;
        /**
         * Whether advertisement status of the prefix is locked, meaning it cannot be
         * changed.
         */
        on_demand_locked?: boolean;
    }
}
export interface BGPPrefixCreateParams {
    /**
     * Path param: Identifier of a Cloudflare account.
     */
    account_id: string;
    /**
     * Body param: IP Prefix in Classless Inter-Domain Routing format.
     */
    cidr?: string;
}
export interface BGPPrefixListParams {
    /**
     * Identifier of a Cloudflare account.
     */
    account_id: string;
}
export interface BGPPrefixEditParams {
    /**
     * Path param: Identifier of a Cloudflare account.
     */
    account_id: string;
    /**
     * Body param: Number of times to prepend the Cloudflare ASN to the BGP AS-Path
     * attribute
     */
    asn_prepend_count?: number;
    /**
     * Body param:
     */
    on_demand?: BGPPrefixEditParams.OnDemand;
    /**
     * Body param: Controls whether the BGP prefix is automatically withdrawn when
     * prefix is withdrawn from Magic routing table (for Magic Transit customers using
     * Direct CNI)
     */
    withdraw_if_no_route?: boolean;
}
export declare namespace BGPPrefixEditParams {
    interface OnDemand {
        advertised?: boolean;
    }
}
export interface BGPPrefixGetParams {
    /**
     * Identifier of a Cloudflare account.
     */
    account_id: string;
}
export declare namespace BGPPrefixes {
    export { type BGPPrefix as BGPPrefix, BGPPrefixesSinglePage as BGPPrefixesSinglePage, type BGPPrefixCreateParams as BGPPrefixCreateParams, type BGPPrefixListParams as BGPPrefixListParams, type BGPPrefixEditParams as BGPPrefixEditParams, type BGPPrefixGetParams as BGPPrefixGetParams, };
}
//# sourceMappingURL=bgp-prefixes.d.ts.map