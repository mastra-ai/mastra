import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Settings extends APIResource {
    /**
     * Updates the current device settings for a Zero Trust account.
     *
     * @example
     * ```ts
     * const deviceSettings =
     *   await client.zeroTrust.devices.settings.update({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    update(params: SettingUpdateParams, options?: Core.RequestOptions): Core.APIPromise<DeviceSettings | null>;
    /**
     * Resets the current device settings for a Zero Trust account.
     *
     * @example
     * ```ts
     * const deviceSettings =
     *   await client.zeroTrust.devices.settings.delete({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    delete(params: SettingDeleteParams, options?: Core.RequestOptions): Core.APIPromise<DeviceSettings | null>;
    /**
     * Patches the current device settings for a Zero Trust account.
     *
     * @example
     * ```ts
     * const deviceSettings =
     *   await client.zeroTrust.devices.settings.edit({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    edit(params: SettingEditParams, options?: Core.RequestOptions): Core.APIPromise<DeviceSettings | null>;
    /**
     * Describes the current device settings for a Zero Trust account.
     *
     * @example
     * ```ts
     * const deviceSettings =
     *   await client.zeroTrust.devices.settings.get({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    get(params: SettingGetParams, options?: Core.RequestOptions): Core.APIPromise<DeviceSettings | null>;
}
export interface DeviceSettings {
    /**
     * Sets the time limit, in seconds, that a user can use an override code to bypass
     * WARP.
     */
    disable_for_time?: number;
    /**
     * Enable gateway proxy filtering on TCP.
     */
    gateway_proxy_enabled?: boolean;
    /**
     * Enable gateway proxy filtering on UDP.
     */
    gateway_udp_proxy_enabled?: boolean;
    /**
     * Enable installation of cloudflare managed root certificate.
     */
    root_certificate_installation_enabled?: boolean;
    /**
     * Enable using CGNAT virtual IPv4.
     */
    use_zt_virtual_ip?: boolean;
}
export interface SettingUpdateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: Sets the time limit, in seconds, that a user can use an override
     * code to bypass WARP.
     */
    disable_for_time?: number;
    /**
     * Body param: Enable gateway proxy filtering on TCP.
     */
    gateway_proxy_enabled?: boolean;
    /**
     * Body param: Enable gateway proxy filtering on UDP.
     */
    gateway_udp_proxy_enabled?: boolean;
    /**
     * Body param: Enable installation of cloudflare managed root certificate.
     */
    root_certificate_installation_enabled?: boolean;
    /**
     * Body param: Enable using CGNAT virtual IPv4.
     */
    use_zt_virtual_ip?: boolean;
}
export interface SettingDeleteParams {
    account_id: string;
}
export interface SettingEditParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: Sets the time limit, in seconds, that a user can use an override
     * code to bypass WARP.
     */
    disable_for_time?: number;
    /**
     * Body param: Enable gateway proxy filtering on TCP.
     */
    gateway_proxy_enabled?: boolean;
    /**
     * Body param: Enable gateway proxy filtering on UDP.
     */
    gateway_udp_proxy_enabled?: boolean;
    /**
     * Body param: Enable installation of cloudflare managed root certificate.
     */
    root_certificate_installation_enabled?: boolean;
    /**
     * Body param: Enable using CGNAT virtual IPv4.
     */
    use_zt_virtual_ip?: boolean;
}
export interface SettingGetParams {
    account_id: string;
}
export declare namespace Settings {
    export { type DeviceSettings as DeviceSettings, type SettingUpdateParams as SettingUpdateParams, type SettingDeleteParams as SettingDeleteParams, type SettingEditParams as SettingEditParams, type SettingGetParams as SettingGetParams, };
}
//# sourceMappingURL=settings.d.ts.map