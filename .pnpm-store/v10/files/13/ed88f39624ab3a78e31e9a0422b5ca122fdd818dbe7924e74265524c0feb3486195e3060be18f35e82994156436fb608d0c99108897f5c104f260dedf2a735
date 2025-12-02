import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as Shared from "../../../shared.js";
import * as TokenAPI from "./token.js";
import { Token, TokenGetParams, TokenGetResponse } from "./token.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../../pagination.js";
export declare class WARPConnector extends APIResource {
    token: TokenAPI.Token;
    /**
     * Creates a new Warp Connector Tunnel in an account.
     *
     * @example
     * ```ts
     * const warpConnector =
     *   await client.zeroTrust.tunnels.warpConnector.create({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     name: 'blog',
     *   });
     * ```
     */
    create(params: WARPConnectorCreateParams, options?: Core.RequestOptions): Core.APIPromise<WARPConnectorCreateResponse>;
    /**
     * Lists and filters Warp Connector Tunnels in an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const warpConnectorListResponse of client.zeroTrust.tunnels.warpConnector.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: WARPConnectorListParams, options?: Core.RequestOptions): Core.PagePromise<WARPConnectorListResponsesV4PagePaginationArray, WARPConnectorListResponse>;
    /**
     * Deletes a Warp Connector Tunnel from an account.
     *
     * @example
     * ```ts
     * const warpConnector =
     *   await client.zeroTrust.tunnels.warpConnector.delete(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    delete(tunnelId: string, params: WARPConnectorDeleteParams, options?: Core.RequestOptions): Core.APIPromise<WARPConnectorDeleteResponse>;
    /**
     * Updates an existing Warp Connector Tunnel.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.tunnels.warpConnector.edit(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    edit(tunnelId: string, params: WARPConnectorEditParams, options?: Core.RequestOptions): Core.APIPromise<WARPConnectorEditResponse>;
    /**
     * Fetches a single Warp Connector Tunnel.
     *
     * @example
     * ```ts
     * const warpConnector =
     *   await client.zeroTrust.tunnels.warpConnector.get(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(tunnelId: string, params: WARPConnectorGetParams, options?: Core.RequestOptions): Core.APIPromise<WARPConnectorGetResponse>;
}
export declare class WARPConnectorListResponsesV4PagePaginationArray extends V4PagePaginationArray<WARPConnectorListResponse> {
}
/**
 * A Cloudflare Tunnel that connects your origin to Cloudflare's edge.
 */
export type WARPConnectorCreateResponse = Shared.CloudflareTunnel | WARPConnectorCreateResponse.TunnelWARPConnectorTunnel;
export declare namespace WARPConnectorCreateResponse {
    /**
     * A Warp Connector Tunnel that connects your origin to Cloudflare's edge.
     */
    interface TunnelWARPConnectorTunnel {
        /**
         * UUID of the tunnel.
         */
        id?: string;
        /**
         * Cloudflare account ID
         */
        account_tag?: string;
        /**
         * @deprecated This field will start returning an empty array. To fetch the
         * connections of a given tunnel, please use the dedicated endpoint
         * `/accounts/{account_id}/{tunnel_type}/{tunnel_id}/connections`
         */
        connections?: Array<TunnelWARPConnectorTunnel.Connection>;
        /**
         * Timestamp of when the tunnel established at least one connection to Cloudflare's
         * edge. If `null`, the tunnel is inactive.
         */
        conns_active_at?: string;
        /**
         * Timestamp of when the tunnel became inactive (no connections to Cloudflare's
         * edge). If `null`, the tunnel is active.
         */
        conns_inactive_at?: string;
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
         * Metadata associated with the tunnel.
         */
        metadata?: unknown;
        /**
         * A user-friendly name for a tunnel.
         */
        name?: string;
        /**
         * The status of the tunnel. Valid values are `inactive` (tunnel has never been
         * run), `degraded` (tunnel is active and able to serve traffic but in an unhealthy
         * state), `healthy` (tunnel is active and able to serve traffic), or `down`
         * (tunnel can not serve traffic as it has no connections to the Cloudflare Edge).
         */
        status?: 'inactive' | 'degraded' | 'healthy' | 'down';
        /**
         * The type of tunnel.
         */
        tun_type?: 'cfd_tunnel' | 'warp_connector' | 'warp' | 'magic' | 'ip_sec' | 'gre' | 'cni';
    }
    namespace TunnelWARPConnectorTunnel {
        interface Connection {
            /**
             * UUID of the Cloudflare Tunnel connection.
             */
            id?: string;
            /**
             * UUID of the Cloudflare Tunnel connector.
             */
            client_id?: string;
            /**
             * The cloudflared version used to establish this connection.
             */
            client_version?: string;
            /**
             * The Cloudflare data center used for this connection.
             */
            colo_name?: string;
            /**
             * Cloudflare continues to track connections for several minutes after they
             * disconnect. This is an optimization to improve latency and reliability of
             * reconnecting. If `true`, the connection has disconnected but is still being
             * tracked. If `false`, the connection is actively serving traffic.
             */
            is_pending_reconnect?: boolean;
            /**
             * Timestamp of when the connection was established.
             */
            opened_at?: string;
            /**
             * The public IP address of the host running cloudflared.
             */
            origin_ip?: string;
            /**
             * UUID of the Cloudflare Tunnel connection.
             */
            uuid?: string;
        }
    }
}
/**
 * A Cloudflare Tunnel that connects your origin to Cloudflare's edge.
 */
export type WARPConnectorListResponse = Shared.CloudflareTunnel | WARPConnectorListResponse.TunnelWARPConnectorTunnel;
export declare namespace WARPConnectorListResponse {
    /**
     * A Warp Connector Tunnel that connects your origin to Cloudflare's edge.
     */
    interface TunnelWARPConnectorTunnel {
        /**
         * UUID of the tunnel.
         */
        id?: string;
        /**
         * Cloudflare account ID
         */
        account_tag?: string;
        /**
         * @deprecated This field will start returning an empty array. To fetch the
         * connections of a given tunnel, please use the dedicated endpoint
         * `/accounts/{account_id}/{tunnel_type}/{tunnel_id}/connections`
         */
        connections?: Array<TunnelWARPConnectorTunnel.Connection>;
        /**
         * Timestamp of when the tunnel established at least one connection to Cloudflare's
         * edge. If `null`, the tunnel is inactive.
         */
        conns_active_at?: string;
        /**
         * Timestamp of when the tunnel became inactive (no connections to Cloudflare's
         * edge). If `null`, the tunnel is active.
         */
        conns_inactive_at?: string;
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
         * Metadata associated with the tunnel.
         */
        metadata?: unknown;
        /**
         * A user-friendly name for a tunnel.
         */
        name?: string;
        /**
         * The status of the tunnel. Valid values are `inactive` (tunnel has never been
         * run), `degraded` (tunnel is active and able to serve traffic but in an unhealthy
         * state), `healthy` (tunnel is active and able to serve traffic), or `down`
         * (tunnel can not serve traffic as it has no connections to the Cloudflare Edge).
         */
        status?: 'inactive' | 'degraded' | 'healthy' | 'down';
        /**
         * The type of tunnel.
         */
        tun_type?: 'cfd_tunnel' | 'warp_connector' | 'warp' | 'magic' | 'ip_sec' | 'gre' | 'cni';
    }
    namespace TunnelWARPConnectorTunnel {
        interface Connection {
            /**
             * UUID of the Cloudflare Tunnel connection.
             */
            id?: string;
            /**
             * UUID of the Cloudflare Tunnel connector.
             */
            client_id?: string;
            /**
             * The cloudflared version used to establish this connection.
             */
            client_version?: string;
            /**
             * The Cloudflare data center used for this connection.
             */
            colo_name?: string;
            /**
             * Cloudflare continues to track connections for several minutes after they
             * disconnect. This is an optimization to improve latency and reliability of
             * reconnecting. If `true`, the connection has disconnected but is still being
             * tracked. If `false`, the connection is actively serving traffic.
             */
            is_pending_reconnect?: boolean;
            /**
             * Timestamp of when the connection was established.
             */
            opened_at?: string;
            /**
             * The public IP address of the host running cloudflared.
             */
            origin_ip?: string;
            /**
             * UUID of the Cloudflare Tunnel connection.
             */
            uuid?: string;
        }
    }
}
/**
 * A Cloudflare Tunnel that connects your origin to Cloudflare's edge.
 */
export type WARPConnectorDeleteResponse = Shared.CloudflareTunnel | WARPConnectorDeleteResponse.TunnelWARPConnectorTunnel;
export declare namespace WARPConnectorDeleteResponse {
    /**
     * A Warp Connector Tunnel that connects your origin to Cloudflare's edge.
     */
    interface TunnelWARPConnectorTunnel {
        /**
         * UUID of the tunnel.
         */
        id?: string;
        /**
         * Cloudflare account ID
         */
        account_tag?: string;
        /**
         * @deprecated This field will start returning an empty array. To fetch the
         * connections of a given tunnel, please use the dedicated endpoint
         * `/accounts/{account_id}/{tunnel_type}/{tunnel_id}/connections`
         */
        connections?: Array<TunnelWARPConnectorTunnel.Connection>;
        /**
         * Timestamp of when the tunnel established at least one connection to Cloudflare's
         * edge. If `null`, the tunnel is inactive.
         */
        conns_active_at?: string;
        /**
         * Timestamp of when the tunnel became inactive (no connections to Cloudflare's
         * edge). If `null`, the tunnel is active.
         */
        conns_inactive_at?: string;
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
         * Metadata associated with the tunnel.
         */
        metadata?: unknown;
        /**
         * A user-friendly name for a tunnel.
         */
        name?: string;
        /**
         * The status of the tunnel. Valid values are `inactive` (tunnel has never been
         * run), `degraded` (tunnel is active and able to serve traffic but in an unhealthy
         * state), `healthy` (tunnel is active and able to serve traffic), or `down`
         * (tunnel can not serve traffic as it has no connections to the Cloudflare Edge).
         */
        status?: 'inactive' | 'degraded' | 'healthy' | 'down';
        /**
         * The type of tunnel.
         */
        tun_type?: 'cfd_tunnel' | 'warp_connector' | 'warp' | 'magic' | 'ip_sec' | 'gre' | 'cni';
    }
    namespace TunnelWARPConnectorTunnel {
        interface Connection {
            /**
             * UUID of the Cloudflare Tunnel connection.
             */
            id?: string;
            /**
             * UUID of the Cloudflare Tunnel connector.
             */
            client_id?: string;
            /**
             * The cloudflared version used to establish this connection.
             */
            client_version?: string;
            /**
             * The Cloudflare data center used for this connection.
             */
            colo_name?: string;
            /**
             * Cloudflare continues to track connections for several minutes after they
             * disconnect. This is an optimization to improve latency and reliability of
             * reconnecting. If `true`, the connection has disconnected but is still being
             * tracked. If `false`, the connection is actively serving traffic.
             */
            is_pending_reconnect?: boolean;
            /**
             * Timestamp of when the connection was established.
             */
            opened_at?: string;
            /**
             * The public IP address of the host running cloudflared.
             */
            origin_ip?: string;
            /**
             * UUID of the Cloudflare Tunnel connection.
             */
            uuid?: string;
        }
    }
}
/**
 * A Cloudflare Tunnel that connects your origin to Cloudflare's edge.
 */
export type WARPConnectorEditResponse = Shared.CloudflareTunnel | WARPConnectorEditResponse.TunnelWARPConnectorTunnel;
export declare namespace WARPConnectorEditResponse {
    /**
     * A Warp Connector Tunnel that connects your origin to Cloudflare's edge.
     */
    interface TunnelWARPConnectorTunnel {
        /**
         * UUID of the tunnel.
         */
        id?: string;
        /**
         * Cloudflare account ID
         */
        account_tag?: string;
        /**
         * @deprecated This field will start returning an empty array. To fetch the
         * connections of a given tunnel, please use the dedicated endpoint
         * `/accounts/{account_id}/{tunnel_type}/{tunnel_id}/connections`
         */
        connections?: Array<TunnelWARPConnectorTunnel.Connection>;
        /**
         * Timestamp of when the tunnel established at least one connection to Cloudflare's
         * edge. If `null`, the tunnel is inactive.
         */
        conns_active_at?: string;
        /**
         * Timestamp of when the tunnel became inactive (no connections to Cloudflare's
         * edge). If `null`, the tunnel is active.
         */
        conns_inactive_at?: string;
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
         * Metadata associated with the tunnel.
         */
        metadata?: unknown;
        /**
         * A user-friendly name for a tunnel.
         */
        name?: string;
        /**
         * The status of the tunnel. Valid values are `inactive` (tunnel has never been
         * run), `degraded` (tunnel is active and able to serve traffic but in an unhealthy
         * state), `healthy` (tunnel is active and able to serve traffic), or `down`
         * (tunnel can not serve traffic as it has no connections to the Cloudflare Edge).
         */
        status?: 'inactive' | 'degraded' | 'healthy' | 'down';
        /**
         * The type of tunnel.
         */
        tun_type?: 'cfd_tunnel' | 'warp_connector' | 'warp' | 'magic' | 'ip_sec' | 'gre' | 'cni';
    }
    namespace TunnelWARPConnectorTunnel {
        interface Connection {
            /**
             * UUID of the Cloudflare Tunnel connection.
             */
            id?: string;
            /**
             * UUID of the Cloudflare Tunnel connector.
             */
            client_id?: string;
            /**
             * The cloudflared version used to establish this connection.
             */
            client_version?: string;
            /**
             * The Cloudflare data center used for this connection.
             */
            colo_name?: string;
            /**
             * Cloudflare continues to track connections for several minutes after they
             * disconnect. This is an optimization to improve latency and reliability of
             * reconnecting. If `true`, the connection has disconnected but is still being
             * tracked. If `false`, the connection is actively serving traffic.
             */
            is_pending_reconnect?: boolean;
            /**
             * Timestamp of when the connection was established.
             */
            opened_at?: string;
            /**
             * The public IP address of the host running cloudflared.
             */
            origin_ip?: string;
            /**
             * UUID of the Cloudflare Tunnel connection.
             */
            uuid?: string;
        }
    }
}
/**
 * A Cloudflare Tunnel that connects your origin to Cloudflare's edge.
 */
export type WARPConnectorGetResponse = Shared.CloudflareTunnel | WARPConnectorGetResponse.TunnelWARPConnectorTunnel;
export declare namespace WARPConnectorGetResponse {
    /**
     * A Warp Connector Tunnel that connects your origin to Cloudflare's edge.
     */
    interface TunnelWARPConnectorTunnel {
        /**
         * UUID of the tunnel.
         */
        id?: string;
        /**
         * Cloudflare account ID
         */
        account_tag?: string;
        /**
         * @deprecated This field will start returning an empty array. To fetch the
         * connections of a given tunnel, please use the dedicated endpoint
         * `/accounts/{account_id}/{tunnel_type}/{tunnel_id}/connections`
         */
        connections?: Array<TunnelWARPConnectorTunnel.Connection>;
        /**
         * Timestamp of when the tunnel established at least one connection to Cloudflare's
         * edge. If `null`, the tunnel is inactive.
         */
        conns_active_at?: string;
        /**
         * Timestamp of when the tunnel became inactive (no connections to Cloudflare's
         * edge). If `null`, the tunnel is active.
         */
        conns_inactive_at?: string;
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
         * Metadata associated with the tunnel.
         */
        metadata?: unknown;
        /**
         * A user-friendly name for a tunnel.
         */
        name?: string;
        /**
         * The status of the tunnel. Valid values are `inactive` (tunnel has never been
         * run), `degraded` (tunnel is active and able to serve traffic but in an unhealthy
         * state), `healthy` (tunnel is active and able to serve traffic), or `down`
         * (tunnel can not serve traffic as it has no connections to the Cloudflare Edge).
         */
        status?: 'inactive' | 'degraded' | 'healthy' | 'down';
        /**
         * The type of tunnel.
         */
        tun_type?: 'cfd_tunnel' | 'warp_connector' | 'warp' | 'magic' | 'ip_sec' | 'gre' | 'cni';
    }
    namespace TunnelWARPConnectorTunnel {
        interface Connection {
            /**
             * UUID of the Cloudflare Tunnel connection.
             */
            id?: string;
            /**
             * UUID of the Cloudflare Tunnel connector.
             */
            client_id?: string;
            /**
             * The cloudflared version used to establish this connection.
             */
            client_version?: string;
            /**
             * The Cloudflare data center used for this connection.
             */
            colo_name?: string;
            /**
             * Cloudflare continues to track connections for several minutes after they
             * disconnect. This is an optimization to improve latency and reliability of
             * reconnecting. If `true`, the connection has disconnected but is still being
             * tracked. If `false`, the connection is actively serving traffic.
             */
            is_pending_reconnect?: boolean;
            /**
             * Timestamp of when the connection was established.
             */
            opened_at?: string;
            /**
             * The public IP address of the host running cloudflared.
             */
            origin_ip?: string;
            /**
             * UUID of the Cloudflare Tunnel connection.
             */
            uuid?: string;
        }
    }
}
export interface WARPConnectorCreateParams {
    /**
     * Path param: Cloudflare account ID
     */
    account_id: string;
    /**
     * Body param: A user-friendly name for a tunnel.
     */
    name: string;
}
export interface WARPConnectorListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Cloudflare account ID
     */
    account_id: string;
    /**
     * Query param:
     */
    exclude_prefix?: string;
    /**
     * Query param: If provided, include only resources that were created (and not
     * deleted) before this time. URL encoded.
     */
    existed_at?: string;
    /**
     * Query param:
     */
    include_prefix?: string;
    /**
     * Query param: If `true`, only include deleted tunnels. If `false`, exclude
     * deleted tunnels. If empty, all tunnels will be included.
     */
    is_deleted?: boolean;
    /**
     * Query param: A user-friendly name for the tunnel.
     */
    name?: string;
    /**
     * Query param: The status of the tunnel. Valid values are `inactive` (tunnel has
     * never been run), `degraded` (tunnel is active and able to serve traffic but in
     * an unhealthy state), `healthy` (tunnel is active and able to serve traffic), or
     * `down` (tunnel can not serve traffic as it has no connections to the Cloudflare
     * Edge).
     */
    status?: 'inactive' | 'degraded' | 'healthy' | 'down';
    /**
     * Query param: UUID of the tunnel.
     */
    uuid?: string;
    /**
     * Query param:
     */
    was_active_at?: string;
    /**
     * Query param:
     */
    was_inactive_at?: string;
}
export interface WARPConnectorDeleteParams {
    /**
     * Cloudflare account ID
     */
    account_id: string;
}
export interface WARPConnectorEditParams {
    /**
     * Path param: Cloudflare account ID
     */
    account_id: string;
    /**
     * Body param: A user-friendly name for a tunnel.
     */
    name?: string;
    /**
     * Body param: Sets the password required to run a locally-managed tunnel. Must be
     * at least 32 bytes and encoded as a base64 string.
     */
    tunnel_secret?: string;
}
export interface WARPConnectorGetParams {
    /**
     * Cloudflare account ID
     */
    account_id: string;
}
export declare namespace WARPConnector {
    export { type WARPConnectorCreateResponse as WARPConnectorCreateResponse, type WARPConnectorListResponse as WARPConnectorListResponse, type WARPConnectorDeleteResponse as WARPConnectorDeleteResponse, type WARPConnectorEditResponse as WARPConnectorEditResponse, type WARPConnectorGetResponse as WARPConnectorGetResponse, WARPConnectorListResponsesV4PagePaginationArray as WARPConnectorListResponsesV4PagePaginationArray, type WARPConnectorCreateParams as WARPConnectorCreateParams, type WARPConnectorListParams as WARPConnectorListParams, type WARPConnectorDeleteParams as WARPConnectorDeleteParams, type WARPConnectorEditParams as WARPConnectorEditParams, type WARPConnectorGetParams as WARPConnectorGetParams, };
    export { Token as Token, type TokenGetResponse as TokenGetResponse, type TokenGetParams as TokenGetParams };
}
//# sourceMappingURL=warp-connector.d.ts.map