import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import { SinglePage } from "../../../../pagination.js";
export declare class Connections extends APIResource {
    /**
     * Removes a connection (aka Cloudflare Tunnel Connector) from a Cloudflare Tunnel
     * independently of its current state. If no connector id (client_id) is provided
     * all connectors will be removed. We recommend running this command after rotating
     * tokens.
     *
     * @example
     * ```ts
     * const connection =
     *   await client.zeroTrust.tunnels.cloudflared.connections.delete(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    delete(tunnelId: string, params: ConnectionDeleteParams, options?: Core.RequestOptions): Core.APIPromise<ConnectionDeleteResponse | null>;
    /**
     * Fetches connection details for a Cloudflare Tunnel.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const client of client.zeroTrust.tunnels.cloudflared.connections.get(
     *   'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(tunnelId: string, params: ConnectionGetParams, options?: Core.RequestOptions): Core.PagePromise<ClientsSinglePage, Client>;
}
export declare class ClientsSinglePage extends SinglePage<Client> {
}
/**
 * A client (typically cloudflared) that maintains connections to a Cloudflare data
 * center.
 */
export interface Client {
    /**
     * UUID of the Cloudflare Tunnel connection.
     */
    id?: string;
    /**
     * The cloudflared OS architecture used to establish this connection.
     */
    arch?: string;
    /**
     * The version of the remote tunnel configuration. Used internally to sync
     * cloudflared with the Zero Trust dashboard.
     */
    config_version?: number;
    /**
     * The Cloudflare Tunnel connections between your origin and Cloudflare's edge.
     */
    conns?: Array<Client.Conn>;
    /**
     * Features enabled for the Cloudflare Tunnel.
     */
    features?: Array<string>;
    /**
     * Timestamp of when the tunnel connection was started.
     */
    run_at?: string;
    /**
     * The cloudflared version used to establish this connection.
     */
    version?: string;
}
export declare namespace Client {
    interface Conn {
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
export type ConnectionDeleteResponse = unknown;
export interface ConnectionDeleteParams {
    /**
     * Path param: Cloudflare account ID
     */
    account_id: string;
    /**
     * Query param: UUID of the Cloudflare Tunnel connector.
     */
    client_id?: string;
}
export interface ConnectionGetParams {
    /**
     * Cloudflare account ID
     */
    account_id: string;
}
export declare namespace Connections {
    export { type Client as Client, type ConnectionDeleteResponse as ConnectionDeleteResponse, ClientsSinglePage as ClientsSinglePage, type ConnectionDeleteParams as ConnectionDeleteParams, type ConnectionGetParams as ConnectionGetParams, };
}
//# sourceMappingURL=connections.d.ts.map