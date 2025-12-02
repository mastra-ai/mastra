import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as FleetStatusAPI from "./fleet-status.js";
import * as DevicesAPI from "./devices.js";
import { DeviceListParams, DeviceListResponse, DeviceListResponsesV4PagePaginationArray, Devices } from "./devices.js";
export declare class FleetStatus extends APIResource {
    devices: DevicesAPI.Devices;
    /**
     * List details for live (up to 60 minutes) devices using WARP
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.dex.fleetStatus.live({
     *     account_id: '01a7362d577a6c3019a474fd6f485823',
     *     since_minutes: 10,
     *   });
     * ```
     */
    live(params: FleetStatusLiveParams, options?: Core.RequestOptions): Core.APIPromise<FleetStatusLiveResponse>;
    /**
     * List details for devices using WARP, up to 7 days
     *
     * @example
     * ```ts
     * await client.zeroTrust.dex.fleetStatus.overTime({
     *   account_id: '01a7362d577a6c3019a474fd6f485823',
     *   from: '2023-10-11T00:00:00Z',
     *   to: '2023-10-11T00:00:00Z',
     * });
     * ```
     */
    overTime(params: FleetStatusOverTimeParams, options?: Core.RequestOptions): Core.APIPromise<void>;
}
export interface LiveStat {
    /**
     * Number of unique devices
     */
    uniqueDevicesTotal?: number;
    value?: string;
}
export interface FleetStatusLiveResponse {
    deviceStats?: FleetStatusLiveResponse.DeviceStats;
}
export declare namespace FleetStatusLiveResponse {
    interface DeviceStats {
        byColo?: Array<FleetStatusAPI.LiveStat> | null;
        byMode?: Array<FleetStatusAPI.LiveStat> | null;
        byPlatform?: Array<FleetStatusAPI.LiveStat> | null;
        byStatus?: Array<FleetStatusAPI.LiveStat> | null;
        byVersion?: Array<FleetStatusAPI.LiveStat> | null;
        /**
         * Number of unique devices
         */
        uniqueDevicesTotal?: number;
    }
}
export interface FleetStatusLiveParams {
    /**
     * Path param: Unique identifier for account
     */
    account_id: string;
    /**
     * Query param: Number of minutes before current time
     */
    since_minutes: number;
}
export interface FleetStatusOverTimeParams {
    /**
     * Path param: Unique identifier for account
     */
    account_id: string;
    /**
     * Query param: Time range beginning in ISO format
     */
    from: string;
    /**
     * Query param: Time range end in ISO format
     */
    to: string;
    /**
     * Query param: Cloudflare colo
     */
    colo?: string;
    /**
     * Query param: Device-specific ID, given as UUID v4
     */
    device_id?: string;
}
export declare namespace FleetStatus {
    export { type LiveStat as LiveStat, type FleetStatusLiveResponse as FleetStatusLiveResponse, type FleetStatusLiveParams as FleetStatusLiveParams, type FleetStatusOverTimeParams as FleetStatusOverTimeParams, };
    export { Devices as Devices, type DeviceListResponse as DeviceListResponse, DeviceListResponsesV4PagePaginationArray as DeviceListResponsesV4PagePaginationArray, type DeviceListParams as DeviceListParams, };
}
//# sourceMappingURL=fleet-status.d.ts.map