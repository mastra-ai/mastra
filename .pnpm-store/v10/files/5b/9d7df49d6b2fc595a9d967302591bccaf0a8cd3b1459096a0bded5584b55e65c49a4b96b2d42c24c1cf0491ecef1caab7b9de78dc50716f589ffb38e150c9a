import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as DevicesAPI from "./devices.js";
import { DeviceListParams, DeviceListResponse, DeviceListResponsesV4PagePagination, Devices } from "./devices.js";
import * as DownloadsAPI from "./downloads.js";
import { DownloadGetParams, Downloads } from "./downloads.js";
import * as QuotaAPI from "./quota.js";
import { Quota, QuotaGetParams, QuotaGetResponse } from "./quota.js";
import { V4PagePagination, type V4PagePaginationParams } from "../../../../pagination.js";
export declare class Commands extends APIResource {
    devices: DevicesAPI.Devices;
    downloads: DownloadsAPI.Downloads;
    quota: QuotaAPI.Quota;
    /**
     * Initiate commands for up to 10 devices per account
     *
     * @example
     * ```ts
     * const command = await client.zeroTrust.dex.commands.create({
     *   account_id: '01a7362d577a6c3019a474fd6f485823',
     *   commands: [
     *     {
     *       command_type: 'pcap',
     *       device_id: 'device_id',
     *       user_email: 'user_email',
     *     },
     *   ],
     * });
     * ```
     */
    create(params: CommandCreateParams, options?: Core.RequestOptions): Core.APIPromise<CommandCreateResponse>;
    /**
     * Retrieves a paginated list of commands issued to devices under the specified
     * account, optionally filtered by time range, device, or other parameters
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const commandListResponse of client.zeroTrust.dex.commands.list(
     *   {
     *     account_id: '01a7362d577a6c3019a474fd6f485823',
     *     page: 1,
     *     per_page: 50,
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: CommandListParams, options?: Core.RequestOptions): Core.PagePromise<CommandListResponsesV4PagePagination, CommandListResponse>;
}
export declare class CommandListResponsesV4PagePagination extends V4PagePagination<CommandListResponse> {
}
export interface CommandCreateResponse {
    /**
     * List of created commands
     */
    commands?: Array<CommandCreateResponse.Command>;
}
export declare namespace CommandCreateResponse {
    interface Command {
        /**
         * Unique identifier for the command
         */
        id?: string;
        /**
         * Command arguments
         */
        args?: {
            [key: string]: string;
        };
        /**
         * Identifier for the device associated with the command
         */
        device_id?: string;
        /**
         * Current status of the command
         */
        status?: 'PENDING_EXEC' | 'PENDING_UPLOAD' | 'SUCCESS' | 'FAILED';
        /**
         * Type of the command (e.g., "pcap" or "warp-diag")
         */
        type?: string;
    }
}
export interface CommandListResponse {
    commands?: Array<CommandListResponse.Command>;
}
export declare namespace CommandListResponse {
    interface Command {
        id?: string;
        completed_date?: string | null;
        created_date?: string;
        device_id?: string;
        filename?: string | null;
        status?: string;
        type?: string;
        user_email?: string;
    }
}
export interface CommandCreateParams {
    /**
     * Path param: unique identifier linked to an account in the API request path
     */
    account_id: string;
    /**
     * Body param: List of device-level commands to execute
     */
    commands: Array<CommandCreateParams.Command>;
}
export declare namespace CommandCreateParams {
    interface Command {
        /**
         * Type of command to execute on the device
         */
        command_type: 'pcap' | 'warp-diag';
        /**
         * Unique identifier for the device
         */
        device_id: string;
        /**
         * Email tied to the device
         */
        user_email: string;
        command_args?: Command.CommandArgs;
    }
    namespace Command {
        interface CommandArgs {
            /**
             * List of interfaces to capture packets on
             */
            interfaces?: Array<'default' | 'tunnel'>;
            /**
             * Maximum file size (in MB) for the capture file. Specifies the maximum file size
             * of the warp-diag zip artifact that can be uploaded. If the zip artifact exceeds
             * the specified max file size, it will NOT be uploaded
             */
            'max-file-size-mb'?: number;
            /**
             * Maximum number of bytes to save for each packet
             */
            'packet-size-bytes'?: number;
            /**
             * Test an IP address from all included or excluded ranges. Tests an IP address
             * from all included or excluded ranges. Essentially the same as running 'route get
             * <ip>'' and collecting the results. This option may increase the time taken to
             * collect the warp-diag
             */
            'test-all-routes'?: boolean;
            /**
             * Limit on capture duration (in minutes)
             */
            'time-limit-min'?: number;
        }
    }
}
export interface CommandListParams extends V4PagePaginationParams {
    /**
     * Path param: unique identifier linked to an account in the API request path
     */
    account_id: string;
    /**
     * Query param: Optionally filter executed commands by command type
     */
    command_type?: string;
    /**
     * Query param: Unique identifier for a device
     */
    device_id?: string;
    /**
     * Query param: Start time for the query in ISO (RFC3339 - ISO 8601) format
     */
    from?: string;
    /**
     * Query param: Optionally filter executed commands by status
     */
    status?: 'PENDING_EXEC' | 'PENDING_UPLOAD' | 'SUCCESS' | 'FAILED';
    /**
     * Query param: End time for the query in ISO (RFC3339 - ISO 8601) format
     */
    to?: string;
    /**
     * Query param: Email tied to the device
     */
    user_email?: string;
}
export declare namespace Commands {
    export { type CommandCreateResponse as CommandCreateResponse, type CommandListResponse as CommandListResponse, CommandListResponsesV4PagePagination as CommandListResponsesV4PagePagination, type CommandCreateParams as CommandCreateParams, type CommandListParams as CommandListParams, };
    export { Devices as Devices, type DeviceListResponse as DeviceListResponse, DeviceListResponsesV4PagePagination as DeviceListResponsesV4PagePagination, type DeviceListParams as DeviceListParams, };
    export { Downloads as Downloads, type DownloadGetParams as DownloadGetParams };
    export { Quota as Quota, type QuotaGetResponse as QuotaGetResponse, type QuotaGetParams as QuotaGetParams };
}
//# sourceMappingURL=commands.d.ts.map