import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as PayloadsAPI from "./payloads.js";
import { PayloadCreateParams, PayloadCreateResponse, PayloadCreateResponsesSinglePage, PayloadDeleteParams, PayloadDeleteResponse, PayloadDeleteResponsesSinglePage, PayloadListParams, PayloadListResponse, PayloadListResponsesSinglePage, Payloads } from "./payloads.js";
import * as SettingsAPI from "./settings.js";
import { SettingGetParams, SettingGetResponse, Settings } from "./settings.js";
export declare class ContentScanning extends APIResource {
    payloads: PayloadsAPI.Payloads;
    settings: SettingsAPI.Settings;
    /**
     * Disable Content Scanning.
     */
    disable(params: ContentScanningDisableParams, options?: Core.RequestOptions): Core.APIPromise<ContentScanningDisableResponse>;
    /**
     * Enable Content Scanning.
     */
    enable(params: ContentScanningEnableParams, options?: Core.RequestOptions): Core.APIPromise<ContentScanningEnableResponse>;
}
export type ContentScanningDisableResponse = unknown;
export type ContentScanningEnableResponse = unknown;
export interface ContentScanningDisableParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export interface ContentScanningEnableParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export declare namespace ContentScanning {
    export { type ContentScanningDisableResponse as ContentScanningDisableResponse, type ContentScanningEnableResponse as ContentScanningEnableResponse, type ContentScanningDisableParams as ContentScanningDisableParams, type ContentScanningEnableParams as ContentScanningEnableParams, };
    export { Payloads as Payloads, type PayloadCreateResponse as PayloadCreateResponse, type PayloadListResponse as PayloadListResponse, type PayloadDeleteResponse as PayloadDeleteResponse, PayloadCreateResponsesSinglePage as PayloadCreateResponsesSinglePage, PayloadListResponsesSinglePage as PayloadListResponsesSinglePage, PayloadDeleteResponsesSinglePage as PayloadDeleteResponsesSinglePage, type PayloadCreateParams as PayloadCreateParams, type PayloadListParams as PayloadListParams, type PayloadDeleteParams as PayloadDeleteParams, };
    export { Settings as Settings, type SettingGetResponse as SettingGetResponse, type SettingGetParams as SettingGetParams, };
}
//# sourceMappingURL=content-scanning.d.ts.map