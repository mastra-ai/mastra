import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Settings extends APIResource {
    /**
     * Update the current settings for the active account
     *
     * @example
     * ```ts
     * const setting =
     *   await client.networkInterconnects.settings.update({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    update(params: SettingUpdateParams, options?: Core.RequestOptions): Core.APIPromise<SettingUpdateResponse>;
    /**
     * Get the current settings for the active account
     *
     * @example
     * ```ts
     * const setting =
     *   await client.networkInterconnects.settings.get({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    get(params: SettingGetParams, options?: Core.RequestOptions): Core.APIPromise<SettingGetResponse>;
}
export interface SettingUpdateResponse {
    default_asn: number;
}
export interface SettingGetResponse {
    default_asn: number;
}
export interface SettingUpdateParams {
    /**
     * Path param: Account tag to update settings for
     */
    account_id: string;
    /**
     * Body param:
     */
    default_asn?: number | null;
}
export interface SettingGetParams {
    /**
     * Account tag to retrieve settings for
     */
    account_id: string;
}
export declare namespace Settings {
    export { type SettingUpdateResponse as SettingUpdateResponse, type SettingGetResponse as SettingGetResponse, type SettingUpdateParams as SettingUpdateParams, type SettingGetParams as SettingGetParams, };
}
//# sourceMappingURL=settings.d.ts.map