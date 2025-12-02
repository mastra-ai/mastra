import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as IPsAPI from "./ips.js";
import { IPGetParams, IPs } from "./ips.js";
import * as NetworksAPI from "./networks.js";
import { NetworkCreateParams, NetworkDeleteParams, NetworkEditParams, Networks } from "./networks.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../../pagination.js";
export declare class Routes extends APIResource {
    ips: IPsAPI.IPs;
    networks: NetworksAPI.Networks;
    /**
     * Routes a private network through a Cloudflare Tunnel.
     *
     * @example
     * ```ts
     * const route = await client.zeroTrust.networks.routes.create(
     *   {
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     network: '172.16.0.0/16',
     *     tunnel_id: 'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *   },
     * );
     * ```
     */
    create(params: RouteCreateParams, options?: Core.RequestOptions): Core.APIPromise<Route>;
    /**
     * Lists and filters private network routes in an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const teamnet of client.zeroTrust.networks.routes.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: RouteListParams, options?: Core.RequestOptions): Core.PagePromise<TeamnetsV4PagePaginationArray, Teamnet>;
    /**
     * Deletes a private network route from an account.
     *
     * @example
     * ```ts
     * const route = await client.zeroTrust.networks.routes.delete(
     *   'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * );
     * ```
     */
    delete(routeId: string, params: RouteDeleteParams, options?: Core.RequestOptions): Core.APIPromise<Route>;
    /**
     * Updates an existing private network route in an account. The fields that are
     * meant to be updated should be provided in the body of the request.
     *
     * @example
     * ```ts
     * const route = await client.zeroTrust.networks.routes.edit(
     *   'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * );
     * ```
     */
    edit(routeId: string, params: RouteEditParams, options?: Core.RequestOptions): Core.APIPromise<Route>;
    /**
     * Get a private network route in an account.
     *
     * @example
     * ```ts
     * const route = await client.zeroTrust.networks.routes.get(
     *   'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * );
     * ```
     */
    get(routeId: string, params: RouteGetParams, options?: Core.RequestOptions): Core.APIPromise<Route>;
}
export declare class TeamnetsV4PagePaginationArray extends V4PagePaginationArray<Teamnet> {
}
export interface NetworkRoute {
    /**
     * UUID of the route.
     */
    id?: string;
    /**
     * Optional remark describing the route.
     */
    comment?: string;
    /**
     * Timestamp of when the resource was created.
     */
    created_at?: string;
    /**
     * Timestamp of when the resource was deleted. If `null`, the resource has not been
     * deleted.
     */
    deleted_at?: string;
    /**
     * The private IPv4 or IPv6 range connected by the route, in CIDR notation.
     */
    network?: string;
    /**
     * UUID of the tunnel.
     */
    tunnel_id?: string;
    /**
     * UUID of the virtual network.
     */
    virtual_network_id?: string;
}
export interface Route {
    /**
     * UUID of the route.
     */
    id?: string;
    /**
     * Optional remark describing the route.
     */
    comment?: string;
    /**
     * Timestamp of when the resource was created.
     */
    created_at?: string;
    /**
     * Timestamp of when the resource was deleted. If `null`, the resource has not been
     * deleted.
     */
    deleted_at?: string;
    /**
     * The private IPv4 or IPv6 range connected by the route, in CIDR notation.
     */
    network?: string;
    /**
     * UUID of the tunnel.
     */
    tunnel_id?: string;
    /**
     * UUID of the virtual network.
     */
    virtual_network_id?: string;
}
export interface Teamnet {
    /**
     * UUID of the route.
     */
    id?: string;
    /**
     * Optional remark describing the route.
     */
    comment?: string;
    /**
     * Timestamp of when the resource was created.
     */
    created_at?: string;
    /**
     * Timestamp of when the resource was deleted. If `null`, the resource has not been
     * deleted.
     */
    deleted_at?: string;
    /**
     * The private IPv4 or IPv6 range connected by the route, in CIDR notation.
     */
    network?: string;
    /**
     * The type of tunnel.
     */
    tun_type?: 'cfd_tunnel' | 'warp_connector' | 'warp' | 'magic' | 'ip_sec' | 'gre' | 'cni';
    /**
     * UUID of the tunnel.
     */
    tunnel_id?: string;
    /**
     * A user-friendly name for a tunnel.
     */
    tunnel_name?: string;
    /**
     * UUID of the virtual network.
     */
    virtual_network_id?: string;
    /**
     * A user-friendly name for the virtual network.
     */
    virtual_network_name?: string;
}
export interface RouteCreateParams {
    /**
     * Path param: Cloudflare account ID
     */
    account_id: string;
    /**
     * Body param: The private IPv4 or IPv6 range connected by the route, in CIDR
     * notation.
     */
    network: string;
    /**
     * Body param: UUID of the tunnel.
     */
    tunnel_id: string;
    /**
     * Body param: Optional remark describing the route.
     */
    comment?: string;
    /**
     * Body param: UUID of the virtual network.
     */
    virtual_network_id?: string;
}
export interface RouteListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Cloudflare account ID
     */
    account_id: string;
    /**
     * Query param: Optional remark describing the route.
     */
    comment?: string;
    /**
     * Query param: If provided, include only resources that were created (and not
     * deleted) before this time. URL encoded.
     */
    existed_at?: string;
    /**
     * Query param: If `true`, only include deleted routes. If `false`, exclude deleted
     * routes. If empty, all routes will be included.
     */
    is_deleted?: boolean;
    /**
     * Query param: If set, only list routes that are contained within this IP range.
     */
    network_subset?: string;
    /**
     * Query param: If set, only list routes that contain this IP range.
     */
    network_superset?: string;
    /**
     * Query param: UUID of the route.
     */
    route_id?: string;
    /**
     * Query param: The types of tunnels to filter by, separated by commas.
     */
    tun_types?: Array<'cfd_tunnel' | 'warp_connector' | 'warp' | 'magic' | 'ip_sec' | 'gre' | 'cni'>;
    /**
     * Query param: UUID of the tunnel.
     */
    tunnel_id?: string;
    /**
     * Query param: UUID of the virtual network.
     */
    virtual_network_id?: string;
}
export interface RouteDeleteParams {
    /**
     * Cloudflare account ID
     */
    account_id: string;
}
export interface RouteEditParams {
    /**
     * Path param: Cloudflare account ID
     */
    account_id: string;
    /**
     * Body param: Optional remark describing the route.
     */
    comment?: string;
    /**
     * Body param: The private IPv4 or IPv6 range connected by the route, in CIDR
     * notation.
     */
    network?: string;
    /**
     * Body param: UUID of the tunnel.
     */
    tunnel_id?: string;
    /**
     * Body param: UUID of the virtual network.
     */
    virtual_network_id?: string;
}
export interface RouteGetParams {
    /**
     * Cloudflare account ID
     */
    account_id: string;
}
export declare namespace Routes {
    export { type NetworkRoute as NetworkRoute, type Route as Route, type Teamnet as Teamnet, TeamnetsV4PagePaginationArray as TeamnetsV4PagePaginationArray, type RouteCreateParams as RouteCreateParams, type RouteListParams as RouteListParams, type RouteDeleteParams as RouteDeleteParams, type RouteEditParams as RouteEditParams, type RouteGetParams as RouteGetParams, };
    export { IPs as IPs, type IPGetParams as IPGetParams };
    export { Networks as Networks, type NetworkCreateParams as NetworkCreateParams, type NetworkDeleteParams as NetworkDeleteParams, type NetworkEditParams as NetworkEditParams, };
}
//# sourceMappingURL=routes.d.ts.map