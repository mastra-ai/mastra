// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import * as RoutesAPI from './routes';

export class Networks extends APIResource {
  /**
   * Routes a private network through a Cloudflare Tunnel. The CIDR in
   * `ip_network_encoded` must be written in URL-encoded format.
   *
   * @deprecated This endpoint and its related APIs are deprecated in favor of the equivalent Tunnel Route (without CIDR) APIs.
   */
  create(
    ipNetworkEncoded: string,
    params: NetworkCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RoutesAPI.Route> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/teamnet/routes/network/${ipNetworkEncoded}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: RoutesAPI.Route }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Deletes a private network route from an account. The CIDR in
   * `ip_network_encoded` must be written in URL-encoded format. If no
   * virtual_network_id is provided it will delete the route from the default vnet.
   * If no tun_type is provided it will fetch the type from the tunnel_id or if that
   * is missing it will assume Cloudflare Tunnel as default. If tunnel_id is provided
   * it will delete the route from that tunnel, otherwise it will delete the route
   * based on the vnet and tun_type.
   *
   * @deprecated This endpoint and its related APIs are deprecated in favor of the equivalent Tunnel Route (without CIDR) APIs.
   */
  delete(
    ipNetworkEncoded: string,
    params: NetworkDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RoutesAPI.Route> {
    const { account_id, tun_type, tunnel_id, virtual_network_id } = params;
    return (
      this._client.delete(`/accounts/${account_id}/teamnet/routes/network/${ipNetworkEncoded}`, {
        query: { tun_type, tunnel_id, virtual_network_id },
        ...options,
      }) as Core.APIPromise<{ result: RoutesAPI.Route }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates an existing private network route in an account. The CIDR in
   * `ip_network_encoded` must be written in URL-encoded format.
   *
   * @deprecated This endpoint and its related APIs are deprecated in favor of the equivalent Tunnel Route (without CIDR) APIs.
   */
  edit(
    ipNetworkEncoded: string,
    params: NetworkEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RoutesAPI.Route> {
    const { account_id } = params;
    return (
      this._client.patch(
        `/accounts/${account_id}/teamnet/routes/network/${ipNetworkEncoded}`,
        options,
      ) as Core.APIPromise<{ result: RoutesAPI.Route }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface NetworkCreateParams {
  /**
   * Path param: Cloudflare account ID
   */
  account_id: string;

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

export interface NetworkDeleteParams {
  /**
   * Path param: Cloudflare account ID
   */
  account_id: string;

  /**
   * Query param: The type of tunnel.
   */
  tun_type?: 'cfd_tunnel' | 'warp_connector' | 'warp' | 'magic' | 'ip_sec' | 'gre' | 'cni';

  /**
   * Query param: UUID of the tunnel.
   */
  tunnel_id?: string;

  /**
   * Query param: UUID of the virtual network.
   */
  virtual_network_id?: string;
}

export interface NetworkEditParams {
  /**
   * Cloudflare account ID
   */
  account_id: string;
}

export declare namespace Networks {
  export {
    type NetworkCreateParams as NetworkCreateParams,
    type NetworkDeleteParams as NetworkDeleteParams,
    type NetworkEditParams as NetworkEditParams,
  };
}
