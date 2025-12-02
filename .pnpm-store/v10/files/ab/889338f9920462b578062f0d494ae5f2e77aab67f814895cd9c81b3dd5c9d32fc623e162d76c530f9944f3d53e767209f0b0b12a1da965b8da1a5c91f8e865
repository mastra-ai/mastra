import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import { V4PagePagination, type V4PagePaginationParams } from "../../../../pagination.js";
export declare class Devices extends APIResource {
    /**
     * List devices with WARP client support for remote captures which have been
     * connected in the last 1 hour.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const deviceListResponse of client.zeroTrust.dex.commands.devices.list(
     *   {
     *     account_id: '01a7362d577a6c3019a474fd6f485823',
     *     page: 1,
     *     per_page: 1,
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: DeviceListParams, options?: Core.RequestOptions): Core.PagePromise<DeviceListResponsesV4PagePagination, DeviceListResponse>;
}
export declare class DeviceListResponsesV4PagePagination extends V4PagePagination<DeviceListResponse> {
}
export interface DeviceListResponse {
    /**
     * List of eligible devices
     */
    devices?: Array<DeviceListResponse.Device>;
}
export declare namespace DeviceListResponse {
    interface Device {
        /**
         * Device identifier (UUID v4)
         */
        deviceId?: string;
        /**
         * Device identifier (human readable)
         */
        deviceName?: string;
        /**
         * Whether the device is eligible for remote captures
         */
        eligible?: boolean;
        /**
         * If the device is not eligible, the reason why.
         */
        ineligibleReason?: string;
        /**
         * User contact email address
         */
        personEmail?: string;
        /**
         * Operating system
         */
        platform?: string;
        /**
         * Network status
         */
        status?: string;
        /**
         * Timestamp in ISO format
         */
        timestamp?: string;
        /**
         * WARP client version
         */
        version?: string;
    }
}
export interface DeviceListParams extends V4PagePaginationParams {
    /**
     * Path param: unique identifier linked to an account in the API request path
     */
    account_id: string;
    /**
     * Query param: Filter devices by name or email
     */
    search?: string;
}
export declare namespace Devices {
    export { type DeviceListResponse as DeviceListResponse, DeviceListResponsesV4PagePagination as DeviceListResponsesV4PagePagination, type DeviceListParams as DeviceListParams, };
}
//# sourceMappingURL=devices.d.ts.map