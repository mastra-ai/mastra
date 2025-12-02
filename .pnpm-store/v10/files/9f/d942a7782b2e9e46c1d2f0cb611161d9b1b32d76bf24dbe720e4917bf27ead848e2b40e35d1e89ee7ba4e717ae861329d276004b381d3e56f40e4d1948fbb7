import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as ApplicationsAPI from "./applications.js";
export declare class Settings extends APIResource {
    /**
     * Updates Access application settings.
     *
     * @example
     * ```ts
     * const setting =
     *   await client.zeroTrust.access.applications.settings.update(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    update(appId: ApplicationsAPI.AppIDParam, params: SettingUpdateParams, options?: Core.RequestOptions): Core.APIPromise<SettingUpdateResponse>;
    /**
     * Updates Access application settings.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.access.applications.settings.edit(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    edit(appId: ApplicationsAPI.AppIDParam, params: SettingEditParams, options?: Core.RequestOptions): Core.APIPromise<SettingEditResponse>;
}
export interface SettingUpdateResponse {
    /**
     * Enables loading application content in an iFrame.
     */
    allow_iframe?: boolean;
    /**
     * Enables automatic authentication through cloudflared.
     */
    skip_interstitial?: boolean;
}
export interface SettingEditResponse {
    /**
     * Enables loading application content in an iFrame.
     */
    allow_iframe?: boolean;
    /**
     * Enables automatic authentication through cloudflared.
     */
    skip_interstitial?: boolean;
}
export interface SettingUpdateParams {
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
    /**
     * Body param: Enables loading application content in an iFrame.
     */
    allow_iframe?: boolean;
    /**
     * Body param: Enables automatic authentication through cloudflared.
     */
    skip_interstitial?: boolean;
}
export interface SettingEditParams {
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
    /**
     * Body param: Enables loading application content in an iFrame.
     */
    allow_iframe?: boolean;
    /**
     * Body param: Enables automatic authentication through cloudflared.
     */
    skip_interstitial?: boolean;
}
export declare namespace Settings {
    export { type SettingUpdateResponse as SettingUpdateResponse, type SettingEditResponse as SettingEditResponse, type SettingUpdateParams as SettingUpdateParams, type SettingEditParams as SettingEditParams, };
}
//# sourceMappingURL=settings.d.ts.map