// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class VirtualNetworks extends APIResource {
  /**
   * Adds a new virtual network to an account.
   *
   * @example
   * ```ts
   * const virtualNetwork =
   *   await client.zeroTrust.networks.virtualNetworks.create({
   *     account_id: '699d98642c564d2e855e9661899b7252',
   *     name: 'us-east-1-vpc',
   *   });
   * ```
   */
  create(params: VirtualNetworkCreateParams, options?: Core.RequestOptions): Core.APIPromise<VirtualNetwork> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/teamnet/virtual_networks`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: VirtualNetwork }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists and filters virtual networks in an account.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const virtualNetwork of client.zeroTrust.networks.virtualNetworks.list(
   *   { account_id: '699d98642c564d2e855e9661899b7252' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: VirtualNetworkListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<VirtualNetworksSinglePage, VirtualNetwork> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/teamnet/virtual_networks`,
      VirtualNetworksSinglePage,
      { query, ...options },
    );
  }

  /**
   * Deletes an existing virtual network.
   *
   * @example
   * ```ts
   * const virtualNetwork =
   *   await client.zeroTrust.networks.virtualNetworks.delete(
   *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '699d98642c564d2e855e9661899b7252' },
   *   );
   * ```
   */
  delete(
    virtualNetworkId: string,
    params: VirtualNetworkDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<VirtualNetwork> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/teamnet/virtual_networks/${virtualNetworkId}`,
        options,
      ) as Core.APIPromise<{ result: VirtualNetwork }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates an existing virtual network.
   *
   * @example
   * ```ts
   * const virtualNetwork =
   *   await client.zeroTrust.networks.virtualNetworks.edit(
   *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '699d98642c564d2e855e9661899b7252' },
   *   );
   * ```
   */
  edit(
    virtualNetworkId: string,
    params: VirtualNetworkEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<VirtualNetwork> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/teamnet/virtual_networks/${virtualNetworkId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: VirtualNetwork }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get a virtual network.
   *
   * @example
   * ```ts
   * const virtualNetwork =
   *   await client.zeroTrust.networks.virtualNetworks.get(
   *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '699d98642c564d2e855e9661899b7252' },
   *   );
   * ```
   */
  get(
    virtualNetworkId: string,
    params: VirtualNetworkGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<VirtualNetwork> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/teamnet/virtual_networks/${virtualNetworkId}`,
        options,
      ) as Core.APIPromise<{ result: VirtualNetwork }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class VirtualNetworksSinglePage extends SinglePage<VirtualNetwork> {}

export interface VirtualNetwork {
  /**
   * UUID of the virtual network.
   */
  id: string;

  /**
   * Optional remark describing the virtual network.
   */
  comment: string;

  /**
   * Timestamp of when the resource was created.
   */
  created_at: string;

  /**
   * If `true`, this virtual network is the default for the account.
   */
  is_default_network: boolean;

  /**
   * A user-friendly name for the virtual network.
   */
  name: string;

  /**
   * Timestamp of when the resource was deleted. If `null`, the resource has not been
   * deleted.
   */
  deleted_at?: string;
}

export interface VirtualNetworkCreateParams {
  /**
   * Path param: Cloudflare account ID
   */
  account_id: string;

  /**
   * Body param: A user-friendly name for the virtual network.
   */
  name: string;

  /**
   * Body param: Optional remark describing the virtual network.
   */
  comment?: string;

  /**
   * @deprecated Use the is_default_network property instead.
   */
  is_default?: boolean;

  /**
   * Body param: If `true`, this virtual network is the default for the account.
   */
  is_default_network?: boolean;
}

export interface VirtualNetworkListParams {
  /**
   * Path param: Cloudflare account ID
   */
  account_id: string;

  /**
   * Query param: UUID of the virtual network.
   */
  id?: string;

  /**
   * Query param: If `true`, only include the default virtual network. If `false`,
   * exclude the default virtual network. If empty, all virtual networks will be
   * included.
   */
  is_default?: boolean;

  /**
   * Query param: If `true`, only include deleted virtual networks. If `false`,
   * exclude deleted virtual networks. If empty, all virtual networks will be
   * included.
   */
  is_deleted?: boolean;

  /**
   * Query param: A user-friendly name for the virtual network.
   */
  name?: string;
}

export interface VirtualNetworkDeleteParams {
  /**
   * Cloudflare account ID
   */
  account_id: string;
}

export interface VirtualNetworkEditParams {
  /**
   * Path param: Cloudflare account ID
   */
  account_id: string;

  /**
   * Body param: Optional remark describing the virtual network.
   */
  comment?: string;

  /**
   * Body param: If `true`, this virtual network is the default for the account.
   */
  is_default_network?: boolean;

  /**
   * Body param: A user-friendly name for the virtual network.
   */
  name?: string;
}

export interface VirtualNetworkGetParams {
  /**
   * Cloudflare account ID
   */
  account_id: string;
}

VirtualNetworks.VirtualNetworksSinglePage = VirtualNetworksSinglePage;

export declare namespace VirtualNetworks {
  export {
    type VirtualNetwork as VirtualNetwork,
    VirtualNetworksSinglePage as VirtualNetworksSinglePage,
    type VirtualNetworkCreateParams as VirtualNetworkCreateParams,
    type VirtualNetworkListParams as VirtualNetworkListParams,
    type VirtualNetworkDeleteParams as VirtualNetworkDeleteParams,
    type VirtualNetworkEditParams as VirtualNetworkEditParams,
    type VirtualNetworkGetParams as VirtualNetworkGetParams,
  };
}
