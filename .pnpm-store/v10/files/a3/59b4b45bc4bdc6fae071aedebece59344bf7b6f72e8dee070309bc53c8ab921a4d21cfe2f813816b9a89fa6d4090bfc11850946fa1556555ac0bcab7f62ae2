import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class OverrideCodes extends APIResource {
    /**
     * Fetches a one-time use admin override code for a device. This relies on the
     * **Admin Override** setting being enabled in your device configuration. Not
     * supported when
     * [multi-user mode](https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/deployment/mdm-deployment/windows-multiuser/)
     * is enabled for the account. **Deprecated:** please use GET
     * /accounts/{account_id}/devices/registrations/{registration_id}/override_codes
     * instead.
     *
     * @deprecated
     */
    list(deviceId: string, params: OverrideCodeListParams, options?: Core.RequestOptions): Core.PagePromise<OverrideCodeListResponsesSinglePage, OverrideCodeListResponse>;
    /**
     * Fetches one-time use admin override codes for a registration. This relies on the
     * **Admin Override** setting being enabled in your device configuration.
     *
     * @example
     * ```ts
     * const overrideCode =
     *   await client.zeroTrust.devices.overrideCodes.get(
     *     'registration_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(registrationId: string, params: OverrideCodeGetParams, options?: Core.RequestOptions): Core.APIPromise<OverrideCodeGetResponse>;
}
export declare class OverrideCodeListResponsesSinglePage extends SinglePage<OverrideCodeListResponse> {
}
export type OverrideCodeListResponse = unknown;
export interface OverrideCodeGetResponse {
    disable_for_time?: {
        [key: string]: string;
    };
}
export interface OverrideCodeListParams {
    account_id: string;
}
export interface OverrideCodeGetParams {
    account_id: string;
}
export declare namespace OverrideCodes {
    export { type OverrideCodeListResponse as OverrideCodeListResponse, type OverrideCodeGetResponse as OverrideCodeGetResponse, OverrideCodeListResponsesSinglePage as OverrideCodeListResponsesSinglePage, type OverrideCodeListParams as OverrideCodeListParams, type OverrideCodeGetParams as OverrideCodeGetParams, };
}
//# sourceMappingURL=override-codes.d.ts.map