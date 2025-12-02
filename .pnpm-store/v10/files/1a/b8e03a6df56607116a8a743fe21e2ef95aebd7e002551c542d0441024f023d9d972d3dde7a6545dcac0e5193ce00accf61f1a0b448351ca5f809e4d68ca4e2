import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class ConnectivitySettings extends APIResource {
    /**
     * Updates the Zero Trust Connectivity Settings for the given account.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.connectivitySettings.edit({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    edit(params: ConnectivitySettingEditParams, options?: Core.RequestOptions): Core.APIPromise<ConnectivitySettingEditResponse>;
    /**
     * Gets the Zero Trust Connectivity Settings for the given account.
     *
     * @example
     * ```ts
     * const connectivitySetting =
     *   await client.zeroTrust.connectivitySettings.get({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    get(params: ConnectivitySettingGetParams, options?: Core.RequestOptions): Core.APIPromise<ConnectivitySettingGetResponse>;
}
export interface ConnectivitySettingEditResponse {
    /**
     * A flag to enable the ICMP proxy for the account network.
     */
    icmp_proxy_enabled?: boolean;
    /**
     * A flag to enable WARP to WARP traffic.
     */
    offramp_warp_enabled?: boolean;
}
export interface ConnectivitySettingGetResponse {
    /**
     * A flag to enable the ICMP proxy for the account network.
     */
    icmp_proxy_enabled?: boolean;
    /**
     * A flag to enable WARP to WARP traffic.
     */
    offramp_warp_enabled?: boolean;
}
export interface ConnectivitySettingEditParams {
    /**
     * Path param: Cloudflare account ID
     */
    account_id: string;
    /**
     * Body param: A flag to enable the ICMP proxy for the account network.
     */
    icmp_proxy_enabled?: boolean;
    /**
     * Body param: A flag to enable WARP to WARP traffic.
     */
    offramp_warp_enabled?: boolean;
}
export interface ConnectivitySettingGetParams {
    /**
     * Cloudflare account ID
     */
    account_id: string;
}
export declare namespace ConnectivitySettings {
    export { type ConnectivitySettingEditResponse as ConnectivitySettingEditResponse, type ConnectivitySettingGetResponse as ConnectivitySettingGetResponse, type ConnectivitySettingEditParams as ConnectivitySettingEditParams, type ConnectivitySettingGetParams as ConnectivitySettingGetParams, };
}
//# sourceMappingURL=connectivity-settings.d.ts.map