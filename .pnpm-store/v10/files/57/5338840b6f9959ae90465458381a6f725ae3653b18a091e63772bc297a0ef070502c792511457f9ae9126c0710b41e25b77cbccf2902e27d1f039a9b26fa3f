import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class AccountSettings extends APIResource {
    /**
     * Creates Worker account settings for an account.
     *
     * @example
     * ```ts
     * const accountSetting =
     *   await client.workers.accountSettings.update({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    update(params: AccountSettingUpdateParams, options?: Core.RequestOptions): Core.APIPromise<AccountSettingUpdateResponse>;
    /**
     * Fetches Worker account settings for an account.
     *
     * @example
     * ```ts
     * const accountSetting =
     *   await client.workers.accountSettings.get({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params: AccountSettingGetParams, options?: Core.RequestOptions): Core.APIPromise<AccountSettingGetResponse>;
}
export interface AccountSettingUpdateResponse {
    default_usage_model?: string;
    green_compute?: boolean;
}
export interface AccountSettingGetResponse {
    default_usage_model?: string;
    green_compute?: boolean;
}
export interface AccountSettingUpdateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param:
     */
    default_usage_model?: string;
    /**
     * Body param:
     */
    green_compute?: boolean;
}
export interface AccountSettingGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace AccountSettings {
    export { type AccountSettingUpdateResponse as AccountSettingUpdateResponse, type AccountSettingGetResponse as AccountSettingGetResponse, type AccountSettingUpdateParams as AccountSettingUpdateParams, type AccountSettingGetParams as AccountSettingGetParams, };
}
//# sourceMappingURL=account-settings.d.ts.map