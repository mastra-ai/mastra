// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class Networks extends APIResource {
  /**
   * Creates a new device managed network.
   *
   * @example
   * ```ts
   * const deviceNetwork =
   *   await client.zeroTrust.devices.networks.create({
   *     account_id: '699d98642c564d2e855e9661899b7252',
   *     config: { tls_sockaddr: 'foo.bar:1234' },
   *     name: 'managed-network-1',
   *     type: 'tls',
   *   });
   * ```
   */
  create(params: NetworkCreateParams, options?: Core.RequestOptions): Core.APIPromise<DeviceNetwork | null> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/devices/networks`, { body, ...options }) as Core.APIPromise<{
        result: DeviceNetwork | null;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates a configured device managed network.
   *
   * @example
   * ```ts
   * const deviceNetwork =
   *   await client.zeroTrust.devices.networks.update(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '699d98642c564d2e855e9661899b7252' },
   *   );
   * ```
   */
  update(
    networkId: string,
    params: NetworkUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DeviceNetwork | null> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/devices/networks/${networkId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: DeviceNetwork | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches a list of managed networks for an account.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const deviceNetwork of client.zeroTrust.devices.networks.list(
   *   { account_id: '699d98642c564d2e855e9661899b7252' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: NetworkListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<DeviceNetworksSinglePage, DeviceNetwork> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/devices/networks`,
      DeviceNetworksSinglePage,
      options,
    );
  }

  /**
   * Deletes a device managed network and fetches a list of the remaining device
   * managed networks for an account.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const deviceNetwork of client.zeroTrust.devices.networks.delete(
   *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *   { account_id: '699d98642c564d2e855e9661899b7252' },
   * )) {
   *   // ...
   * }
   * ```
   */
  delete(
    networkId: string,
    params: NetworkDeleteParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<DeviceNetworksSinglePage, DeviceNetwork> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/devices/networks/${networkId}`,
      DeviceNetworksSinglePage,
      { method: 'delete', ...options },
    );
  }

  /**
   * Fetches details for a single managed network.
   *
   * @example
   * ```ts
   * const deviceNetwork =
   *   await client.zeroTrust.devices.networks.get(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '699d98642c564d2e855e9661899b7252' },
   *   );
   * ```
   */
  get(
    networkId: string,
    params: NetworkGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DeviceNetwork | null> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/devices/networks/${networkId}`, options) as Core.APIPromise<{
        result: DeviceNetwork | null;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class DeviceNetworksSinglePage extends SinglePage<DeviceNetwork> {}

export interface DeviceNetwork {
  /**
   * The configuration object containing information for the WARP client to detect
   * the managed network.
   */
  config?: DeviceNetwork.Config;

  /**
   * The name of the device managed network. This name must be unique.
   */
  name?: string;

  /**
   * API UUID.
   */
  network_id?: string;

  /**
   * The type of device managed network.
   */
  type?: 'tls';
}

export namespace DeviceNetwork {
  /**
   * The configuration object containing information for the WARP client to detect
   * the managed network.
   */
  export interface Config {
    /**
     * A network address of the form "host:port" that the WARP client will use to
     * detect the presence of a TLS host.
     */
    tls_sockaddr: string;

    /**
     * The SHA-256 hash of the TLS certificate presented by the host found at
     * tls_sockaddr. If absent, regular certificate verification (trusted roots, valid
     * timestamp, etc) will be used to validate the certificate.
     */
    sha256?: string;
  }
}

export interface NetworkCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: The configuration object containing information for the WARP client
   * to detect the managed network.
   */
  config: NetworkCreateParams.Config;

  /**
   * Body param: The name of the device managed network. This name must be unique.
   */
  name: string;

  /**
   * Body param: The type of device managed network.
   */
  type: 'tls';
}

export namespace NetworkCreateParams {
  /**
   * The configuration object containing information for the WARP client to detect
   * the managed network.
   */
  export interface Config {
    /**
     * A network address of the form "host:port" that the WARP client will use to
     * detect the presence of a TLS host.
     */
    tls_sockaddr: string;

    /**
     * The SHA-256 hash of the TLS certificate presented by the host found at
     * tls_sockaddr. If absent, regular certificate verification (trusted roots, valid
     * timestamp, etc) will be used to validate the certificate.
     */
    sha256?: string;
  }
}

export interface NetworkUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: The configuration object containing information for the WARP client
   * to detect the managed network.
   */
  config?: NetworkUpdateParams.Config;

  /**
   * Body param: The name of the device managed network. This name must be unique.
   */
  name?: string;

  /**
   * Body param: The type of device managed network.
   */
  type?: 'tls';
}

export namespace NetworkUpdateParams {
  /**
   * The configuration object containing information for the WARP client to detect
   * the managed network.
   */
  export interface Config {
    /**
     * A network address of the form "host:port" that the WARP client will use to
     * detect the presence of a TLS host.
     */
    tls_sockaddr: string;

    /**
     * The SHA-256 hash of the TLS certificate presented by the host found at
     * tls_sockaddr. If absent, regular certificate verification (trusted roots, valid
     * timestamp, etc) will be used to validate the certificate.
     */
    sha256?: string;
  }
}

export interface NetworkListParams {
  account_id: string;
}

export interface NetworkDeleteParams {
  account_id: string;
}

export interface NetworkGetParams {
  account_id: string;
}

Networks.DeviceNetworksSinglePage = DeviceNetworksSinglePage;

export declare namespace Networks {
  export {
    type DeviceNetwork as DeviceNetwork,
    DeviceNetworksSinglePage as DeviceNetworksSinglePage,
    type NetworkCreateParams as NetworkCreateParams,
    type NetworkUpdateParams as NetworkUpdateParams,
    type NetworkListParams as NetworkListParams,
    type NetworkDeleteParams as NetworkDeleteParams,
    type NetworkGetParams as NetworkGetParams,
  };
}
