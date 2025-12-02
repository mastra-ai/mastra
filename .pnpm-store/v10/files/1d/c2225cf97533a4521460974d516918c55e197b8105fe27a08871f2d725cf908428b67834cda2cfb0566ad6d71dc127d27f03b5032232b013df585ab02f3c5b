import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Settings extends APIResource {
    /**
     * Retrieve the current status of Content Scanning.
     */
    get(params: SettingGetParams, options?: Core.RequestOptions): Core.APIPromise<SettingGetResponse>;
}
/**
 * Defines the status for Content Scanning.
 */
export interface SettingGetResponse {
    /**
     * Defines the last modification date (ISO 8601) of the Content Scanning status.
     */
    modified?: string;
    /**
     * Defines the status of Content Scanning.
     */
    value?: string;
}
export interface SettingGetParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export declare namespace Settings {
    export { type SettingGetResponse as SettingGetResponse, type SettingGetParams as SettingGetParams };
}
//# sourceMappingURL=settings.d.ts.map