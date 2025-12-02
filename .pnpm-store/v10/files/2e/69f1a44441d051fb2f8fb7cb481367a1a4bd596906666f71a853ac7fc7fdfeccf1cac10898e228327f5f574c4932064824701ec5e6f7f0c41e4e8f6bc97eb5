// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as FullAPI from './full';
import { Full, FullGetParams } from './full';

export class Configs extends APIResource {
  full: FullAPI.Full = new FullAPI.Full(this._client);

  /**
   * Create a new network monitoring configuration.
   *
   * @example
   * ```ts
   * const configuration =
   *   await client.magicNetworkMonitoring.configs.create({
   *     account_id: '6f91088a406011ed95aed352566e8d4c',
   *     default_sampling: 1,
   *     name: "cloudflare user's account",
   *   });
   * ```
   */
  create(params: ConfigCreateParams, options?: Core.RequestOptions): Core.APIPromise<Configuration> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/mnm/config`, { body, ...options }) as Core.APIPromise<{
        result: Configuration;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update an existing network monitoring configuration, requires the entire
   * configuration to be updated at once.
   *
   * @example
   * ```ts
   * const configuration =
   *   await client.magicNetworkMonitoring.configs.update({
   *     account_id: '6f91088a406011ed95aed352566e8d4c',
   *     default_sampling: 1,
   *     name: "cloudflare user's account",
   *   });
   * ```
   */
  update(params: ConfigUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Configuration> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/mnm/config`, { body, ...options }) as Core.APIPromise<{
        result: Configuration;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Delete an existing network monitoring configuration.
   *
   * @example
   * ```ts
   * const configuration =
   *   await client.magicNetworkMonitoring.configs.delete({
   *     account_id: '6f91088a406011ed95aed352566e8d4c',
   *   });
   * ```
   */
  delete(params: ConfigDeleteParams, options?: Core.RequestOptions): Core.APIPromise<Configuration> {
    const { account_id } = params;
    return (
      this._client.delete(`/accounts/${account_id}/mnm/config`, options) as Core.APIPromise<{
        result: Configuration;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update fields in an existing network monitoring configuration.
   *
   * @example
   * ```ts
   * const configuration =
   *   await client.magicNetworkMonitoring.configs.edit({
   *     account_id: '6f91088a406011ed95aed352566e8d4c',
   *   });
   * ```
   */
  edit(params: ConfigEditParams, options?: Core.RequestOptions): Core.APIPromise<Configuration> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/mnm/config`, { body, ...options }) as Core.APIPromise<{
        result: Configuration;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists default sampling, router IPs and warp devices for account.
   *
   * @example
   * ```ts
   * const configuration =
   *   await client.magicNetworkMonitoring.configs.get({
   *     account_id: '6f91088a406011ed95aed352566e8d4c',
   *   });
   * ```
   */
  get(params: ConfigGetParams, options?: Core.RequestOptions): Core.APIPromise<Configuration> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/mnm/config`, options) as Core.APIPromise<{
        result: Configuration;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface Configuration {
  /**
   * Fallback sampling rate of flow messages being sent in packets per second. This
   * should match the packet sampling rate configured on the router.
   */
  default_sampling: number;

  /**
   * The account name.
   */
  name: string;

  router_ips: Array<string>;

  warp_devices: Array<Configuration.WARPDevice>;
}

export namespace Configuration {
  /**
   * Object representing a warp device with an ID and name.
   */
  export interface WARPDevice {
    /**
     * Unique identifier for the warp device.
     */
    id: string;

    /**
     * Name of the warp device.
     */
    name: string;

    /**
     * IPv4 CIDR of the router sourcing flow data associated with this warp device.
     * Only /32 addresses are currently supported.
     */
    router_ip: string;
  }
}

export interface ConfigCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: Fallback sampling rate of flow messages being sent in packets per
   * second. This should match the packet sampling rate configured on the router.
   */
  default_sampling: number;

  /**
   * Body param: The account name.
   */
  name: string;

  /**
   * Body param:
   */
  router_ips?: Array<string>;

  /**
   * Body param:
   */
  warp_devices?: Array<ConfigCreateParams.WARPDevice>;
}

export namespace ConfigCreateParams {
  /**
   * Object representing a warp device with an ID and name.
   */
  export interface WARPDevice {
    /**
     * Unique identifier for the warp device.
     */
    id: string;

    /**
     * Name of the warp device.
     */
    name: string;

    /**
     * IPv4 CIDR of the router sourcing flow data associated with this warp device.
     * Only /32 addresses are currently supported.
     */
    router_ip: string;
  }
}

export interface ConfigUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: Fallback sampling rate of flow messages being sent in packets per
   * second. This should match the packet sampling rate configured on the router.
   */
  default_sampling: number;

  /**
   * Body param: The account name.
   */
  name: string;

  /**
   * Body param:
   */
  router_ips?: Array<string>;

  /**
   * Body param:
   */
  warp_devices?: Array<ConfigUpdateParams.WARPDevice>;
}

export namespace ConfigUpdateParams {
  /**
   * Object representing a warp device with an ID and name.
   */
  export interface WARPDevice {
    /**
     * Unique identifier for the warp device.
     */
    id: string;

    /**
     * Name of the warp device.
     */
    name: string;

    /**
     * IPv4 CIDR of the router sourcing flow data associated with this warp device.
     * Only /32 addresses are currently supported.
     */
    router_ip: string;
  }
}

export interface ConfigDeleteParams {
  account_id: string;
}

export interface ConfigEditParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: Fallback sampling rate of flow messages being sent in packets per
   * second. This should match the packet sampling rate configured on the router.
   */
  default_sampling?: number;

  /**
   * Body param: The account name.
   */
  name?: string;

  /**
   * Body param:
   */
  router_ips?: Array<string>;

  /**
   * Body param:
   */
  warp_devices?: Array<ConfigEditParams.WARPDevice>;
}

export namespace ConfigEditParams {
  /**
   * Object representing a warp device with an ID and name.
   */
  export interface WARPDevice {
    /**
     * Unique identifier for the warp device.
     */
    id: string;

    /**
     * Name of the warp device.
     */
    name: string;

    /**
     * IPv4 CIDR of the router sourcing flow data associated with this warp device.
     * Only /32 addresses are currently supported.
     */
    router_ip: string;
  }
}

export interface ConfigGetParams {
  account_id: string;
}

Configs.Full = Full;

export declare namespace Configs {
  export {
    type Configuration as Configuration,
    type ConfigCreateParams as ConfigCreateParams,
    type ConfigUpdateParams as ConfigUpdateParams,
    type ConfigDeleteParams as ConfigDeleteParams,
    type ConfigEditParams as ConfigEditParams,
    type ConfigGetParams as ConfigGetParams,
  };

  export { Full as Full, type FullGetParams as FullGetParams };
}
