import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as Shared from "../../../shared.js";
import * as ConfigurationsAPI from "./configurations.js";
import { ConfigurationGetParams, ConfigurationGetResponse, ConfigurationUpdateParams, ConfigurationUpdateResponse, Configurations } from "./configurations.js";
import * as ConnectionsAPI from "./connections.js";
import { Client, ClientsSinglePage, ConnectionDeleteParams, ConnectionDeleteResponse, ConnectionGetParams, Connections } from "./connections.js";
import * as ConnectorsAPI from "./connectors.js";
import { ConnectorGetParams, Connectors } from "./connectors.js";
import * as ManagementAPI from "./management.js";
import { Management, ManagementCreateParams, ManagementCreateResponse } from "./management.js";
import * as TokenAPI from "./token.js";
import { Token, TokenGetParams, TokenGetResponse } from "./token.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../../pagination.js";
export declare class Cloudflared extends APIResource {
    configurations: ConfigurationsAPI.Configurations;
    connections: ConnectionsAPI.Connections;
    token: TokenAPI.Token;
    connectors: ConnectorsAPI.Connectors;
    management: ManagementAPI.Management;
    /**
     * Creates a new Cloudflare Tunnel in an account.
     *
     * @example
     * ```ts
     * const cloudflared =
     *   await client.zeroTrust.tunnels.cloudflared.create({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     name: 'blog',
     *   });
     * ```
     */
    create(params: CloudflaredCreateParams, options?: Core.RequestOptions): Core.APIPromise<CloudflaredCreateResponse>;
    /**
     * Lists and filters Cloudflare Tunnels in an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const cloudflaredListResponse of client.zeroTrust.tunnels.cloudflared.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: CloudflaredListParams, options?: Core.RequestOptions): Core.PagePromise<CloudflaredListResponsesV4PagePaginationArray, CloudflaredListResponse>;
    /**
     * Deletes a Cloudflare Tunnel from an account.
     *
     * @example
     * ```ts
     * const cloudflared =
     *   await client.zeroTrust.tunnels.cloudflared.delete(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    delete(tunnelId: string, params: CloudflaredDeleteParams, options?: Core.RequestOptions): Core.APIPromise<CloudflaredDeleteResponse>;
    /**
     * Updates an existing Cloudflare Tunnel.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.tunnels.cloudflared.edit(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    edit(tunnelId: string, params: CloudflaredEditParams, options?: Core.RequestOptions): Core.APIPromise<CloudflaredEditResponse>;
    /**
     * Fetches a single Cloudflare Tunnel.
     *
     * @example
     * ```ts
     * const cloudflared =
     *   await client.zeroTrust.tunnels.cloudflared.get(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(tunnelId: string, params: CloudflaredGetParams, options?: Core.RequestOptions): Core.APIPromise<CloudflaredGetResponse>;
}
export declare class CloudflaredListResponsesV4PagePaginationArray extends V4PagePaginationArray<CloudflaredListResponse> {
}
/**
 * A Cloudflare Tunnel that connects your origin to Cloudflare's edge.
 */
export type CloudflaredCreateResponse = Shared.CloudflareTunnel | CloudflaredCreateResponse.TunnelWARPConnectorTunnel;
export declare namespace CloudflaredCreateResponse {
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
export type CloudflaredListResponse = Shared.CloudflareTunnel | CloudflaredListResponse.TunnelWARPConnectorTunnel;
export declare namespace CloudflaredListResponse {
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
export type CloudflaredDeleteResponse = Shared.CloudflareTunnel | CloudflaredDeleteResponse.TunnelWARPConnectorTunnel;
export declare namespace CloudflaredDeleteResponse {
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
export type CloudflaredEditResponse = Shared.CloudflareTunnel | CloudflaredEditResponse.TunnelWARPConnectorTunnel;
export declare namespace CloudflaredEditResponse {
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
export type CloudflaredGetResponse = Shared.CloudflareTunnel | CloudflaredGetResponse.TunnelWARPConnectorTunnel;
export declare namespace CloudflaredGetResponse {
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
export interface CloudflaredCreateParams {
    /**
     * Path param: Cloudflare account ID
     */
    account_id: string;
    /**
     * Body param: A user-friendly name for a tunnel.
     */
    name: string;
    /**
     * Body param: Indicates if this is a locally or remotely configured tunnel. If
     * `local`, manage the tunnel using a YAML file on the origin machine. If
     * `cloudflare`, manage the tunnel on the Zero Trust dashboard.
     */
    config_src?: 'local' | 'cloudflare';
    /**
     * Body param: Sets the password required to run a locally-managed tunnel. Must be
     * at least 32 bytes and encoded as a base64 string.
     */
    tunnel_secret?: string;
}
export interface CloudflaredListParams extends V4PagePaginationArrayParams {
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
     * Query param: A user-friendly name for a tunnel.
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
export interface CloudflaredDeleteParams {
    /**
     * Cloudflare account ID
     */
    account_id: string;
}
export interface CloudflaredEditParams {
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
export interface CloudflaredGetParams {
    /**
     * Cloudflare account ID
     */
    account_id: string;
}
export declare namespace Cloudflared {
    export { type CloudflaredCreateResponse as CloudflaredCreateResponse, type CloudflaredListResponse as CloudflaredListResponse, type CloudflaredDeleteResponse as CloudflaredDeleteResponse, type CloudflaredEditResponse as CloudflaredEditResponse, type CloudflaredGetResponse as CloudflaredGetResponse, CloudflaredListResponsesV4PagePaginationArray as CloudflaredListResponsesV4PagePaginationArray, type CloudflaredCreateParams as CloudflaredCreateParams, type CloudflaredListParams as CloudflaredListParams, type CloudflaredDeleteParams as CloudflaredDeleteParams, type CloudflaredEditParams as CloudflaredEditParams, type CloudflaredGetParams as CloudflaredGetParams, };
    export { Configurations as Configurations, type ConfigurationUpdateResponse as ConfigurationUpdateResponse, type ConfigurationGetResponse as ConfigurationGetResponse, type ConfigurationUpdateParams as ConfigurationUpdateParams, type ConfigurationGetParams as ConfigurationGetParams, };
    export { Connections as Connections, type Client as Client, type ConnectionDeleteResponse as ConnectionDeleteResponse, ClientsSinglePage as ClientsSinglePage, type ConnectionDeleteParams as ConnectionDeleteParams, type ConnectionGetParams as ConnectionGetParams, };
    export { Token as Token, type TokenGetResponse as TokenGetResponse, type TokenGetParams as TokenGetParams };
    export { Connectors as Connectors, type ConnectorGetParams as ConnectorGetParams };
    export { Management as Management, type ManagementCreateResponse as ManagementCreateResponse, type ManagementCreateParams as ManagementCreateParams, };
}
//# sourceMappingURL=cloudflared.d.ts.map