// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as Shared from '../../shared';
import * as CloudflaredAPI from './cloudflared/cloudflared';
import {
  Cloudflared,
  CloudflaredCreateParams,
  CloudflaredCreateResponse,
  CloudflaredDeleteParams,
  CloudflaredDeleteResponse,
  CloudflaredEditParams,
  CloudflaredEditResponse,
  CloudflaredGetParams,
  CloudflaredGetResponse,
  CloudflaredListParams,
  CloudflaredListResponse,
  CloudflaredListResponsesV4PagePaginationArray,
} from './cloudflared/cloudflared';
import * as WARPConnectorAPI from './warp-connector/warp-connector';
import {
  WARPConnector,
  WARPConnectorCreateParams,
  WARPConnectorCreateResponse,
  WARPConnectorDeleteParams,
  WARPConnectorDeleteResponse,
  WARPConnectorEditParams,
  WARPConnectorEditResponse,
  WARPConnectorGetParams,
  WARPConnectorGetResponse,
  WARPConnectorListParams,
  WARPConnectorListResponse,
  WARPConnectorListResponsesV4PagePaginationArray,
} from './warp-connector/warp-connector';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../../pagination';

export class Tunnels extends APIResource {
  cloudflared: CloudflaredAPI.Cloudflared = new CloudflaredAPI.Cloudflared(this._client);
  warpConnector: WARPConnectorAPI.WARPConnector = new WARPConnectorAPI.WARPConnector(this._client);

  /**
   * Lists and filters all types of Tunnels in an account.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const tunnelListResponse of client.zeroTrust.tunnels.list(
   *   { account_id: '699d98642c564d2e855e9661899b7252' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: TunnelListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<TunnelListResponsesV4PagePaginationArray, TunnelListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/tunnels`,
      TunnelListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }
}

export class TunnelListResponsesV4PagePaginationArray extends V4PagePaginationArray<TunnelListResponse> {}

export interface Connection {
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
   * UUID of the Cloudflare Tunnel connection.
   */
  uuid?: string;
}

/**
 * A Cloudflare Tunnel that connects your origin to Cloudflare's edge.
 */
export type TunnelListResponse = Shared.CloudflareTunnel | TunnelListResponse.TunnelWARPConnectorTunnel;

export namespace TunnelListResponse {
  /**
   * A Warp Connector Tunnel that connects your origin to Cloudflare's edge.
   */
  export interface TunnelWARPConnectorTunnel {
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

  export namespace TunnelWARPConnectorTunnel {
    export interface Connection {
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

export interface TunnelListParams extends V4PagePaginationArrayParams {
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
   * Query param: The types of tunnels to filter by, separated by commas.
   */
  tun_types?: Array<'cfd_tunnel' | 'warp_connector' | 'warp' | 'magic' | 'ip_sec' | 'gre' | 'cni'>;

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

Tunnels.TunnelListResponsesV4PagePaginationArray = TunnelListResponsesV4PagePaginationArray;
Tunnels.Cloudflared = Cloudflared;
Tunnels.CloudflaredListResponsesV4PagePaginationArray = CloudflaredListResponsesV4PagePaginationArray;
Tunnels.WARPConnector = WARPConnector;
Tunnels.WARPConnectorListResponsesV4PagePaginationArray = WARPConnectorListResponsesV4PagePaginationArray;

export declare namespace Tunnels {
  export {
    type Connection as Connection,
    type TunnelListResponse as TunnelListResponse,
    TunnelListResponsesV4PagePaginationArray as TunnelListResponsesV4PagePaginationArray,
    type TunnelListParams as TunnelListParams,
  };

  export {
    Cloudflared as Cloudflared,
    type CloudflaredCreateResponse as CloudflaredCreateResponse,
    type CloudflaredListResponse as CloudflaredListResponse,
    type CloudflaredDeleteResponse as CloudflaredDeleteResponse,
    type CloudflaredEditResponse as CloudflaredEditResponse,
    type CloudflaredGetResponse as CloudflaredGetResponse,
    CloudflaredListResponsesV4PagePaginationArray as CloudflaredListResponsesV4PagePaginationArray,
    type CloudflaredCreateParams as CloudflaredCreateParams,
    type CloudflaredListParams as CloudflaredListParams,
    type CloudflaredDeleteParams as CloudflaredDeleteParams,
    type CloudflaredEditParams as CloudflaredEditParams,
    type CloudflaredGetParams as CloudflaredGetParams,
  };

  export {
    WARPConnector as WARPConnector,
    type WARPConnectorCreateResponse as WARPConnectorCreateResponse,
    type WARPConnectorListResponse as WARPConnectorListResponse,
    type WARPConnectorDeleteResponse as WARPConnectorDeleteResponse,
    type WARPConnectorEditResponse as WARPConnectorEditResponse,
    type WARPConnectorGetResponse as WARPConnectorGetResponse,
    WARPConnectorListResponsesV4PagePaginationArray as WARPConnectorListResponsesV4PagePaginationArray,
    type WARPConnectorCreateParams as WARPConnectorCreateParams,
    type WARPConnectorListParams as WARPConnectorListParams,
    type WARPConnectorDeleteParams as WARPConnectorDeleteParams,
    type WARPConnectorEditParams as WARPConnectorEditParams,
    type WARPConnectorGetParams as WARPConnectorGetParams,
  };
}
