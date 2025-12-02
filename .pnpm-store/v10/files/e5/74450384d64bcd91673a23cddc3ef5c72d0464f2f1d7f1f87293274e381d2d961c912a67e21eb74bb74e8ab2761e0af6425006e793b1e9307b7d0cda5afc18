import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Settings extends APIResource {
    /**
     * Enable or disable zone-level authenticated origin pulls. 'enabled' should be set
     * true either before/after the certificate is uploaded to see the certificate in
     * use.
     *
     * @example
     * ```ts
     * const setting =
     *   await client.originTLSClientAuth.settings.update({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     enabled: true,
     *   });
     * ```
     */
    update(params: SettingUpdateParams, options?: Core.RequestOptions): Core.APIPromise<SettingUpdateResponse>;
    /**
     * Get whether zone-level authenticated origin pulls is enabled or not. It is false
     * by default.
     *
     * @example
     * ```ts
     * const setting =
     *   await client.originTLSClientAuth.settings.get({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params: SettingGetParams, options?: Core.RequestOptions): Core.APIPromise<SettingGetResponse>;
}
export interface SettingUpdateResponse {
    /**
     * Indicates whether zone-level authenticated origin pulls is enabled.
     */
    enabled?: boolean;
}
export interface SettingGetResponse {
    /**
     * Indicates whether zone-level authenticated origin pulls is enabled.
     */
    enabled?: boolean;
}
export interface SettingUpdateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: Indicates whether zone-level authenticated origin pulls is enabled.
     */
    enabled: boolean;
}
export interface SettingGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace Settings {
    export { type SettingUpdateResponse as SettingUpdateResponse, type SettingGetResponse as SettingGetResponse, type SettingUpdateParams as SettingUpdateParams, type SettingGetParams as SettingGetParams, };
}
//# sourceMappingURL=settings.d.ts.map