import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as FullAPI from "./full.js";
import { Full, FullGetParams } from "./full.js";
export declare class Configs extends APIResource {
    full: FullAPI.Full;
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
    create(params: ConfigCreateParams, options?: Core.RequestOptions): Core.APIPromise<Configuration>;
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
    update(params: ConfigUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Configuration>;
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
    delete(params: ConfigDeleteParams, options?: Core.RequestOptions): Core.APIPromise<Configuration>;
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
    edit(params: ConfigEditParams, options?: Core.RequestOptions): Core.APIPromise<Configuration>;
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
    get(params: ConfigGetParams, options?: Core.RequestOptions): Core.APIPromise<Configuration>;
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
export declare namespace Configuration {
    /**
     * Object representing a warp device with an ID and name.
     */
    interface WARPDevice {
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
export declare namespace ConfigCreateParams {
    /**
     * Object representing a warp device with an ID and name.
     */
    interface WARPDevice {
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
export declare namespace ConfigUpdateParams {
    /**
     * Object representing a warp device with an ID and name.
     */
    interface WARPDevice {
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
export declare namespace ConfigEditParams {
    /**
     * Object representing a warp device with an ID and name.
     */
    interface WARPDevice {
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
export declare namespace Configs {
    export { type Configuration as Configuration, type ConfigCreateParams as ConfigCreateParams, type ConfigUpdateParams as ConfigUpdateParams, type ConfigDeleteParams as ConfigDeleteParams, type ConfigEditParams as ConfigEditParams, type ConfigGetParams as ConfigGetParams, };
    export { Full as Full, type FullGetParams as FullGetParams };
}
//# sourceMappingURL=configs.d.ts.map