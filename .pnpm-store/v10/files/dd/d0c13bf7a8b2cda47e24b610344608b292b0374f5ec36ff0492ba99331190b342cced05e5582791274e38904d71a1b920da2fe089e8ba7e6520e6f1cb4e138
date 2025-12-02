// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import * as DevicesAPI from './devices';
import {
  DeviceListParams,
  DeviceListResponse,
  DeviceListResponsesV4PagePagination,
  Devices,
} from './devices';
import * as DownloadsAPI from './downloads';
import { DownloadGetParams, Downloads } from './downloads';
import * as QuotaAPI from './quota';
import { Quota, QuotaGetParams, QuotaGetResponse } from './quota';
import { V4PagePagination, type V4PagePaginationParams } from '../../../../pagination';

export class Commands extends APIResource {
  devices: DevicesAPI.Devices = new DevicesAPI.Devices(this._client);
  downloads: DownloadsAPI.Downloads = new DownloadsAPI.Downloads(this._client);
  quota: QuotaAPI.Quota = new QuotaAPI.Quota(this._client);

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
  create(params: CommandCreateParams, options?: Core.RequestOptions): Core.APIPromise<CommandCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/dex/commands`, { body, ...options }) as Core.APIPromise<{
        result: CommandCreateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

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
  list(
    params: CommandListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<CommandListResponsesV4PagePagination, CommandListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/dex/commands`,
      CommandListResponsesV4PagePagination,
      { query, ...options },
    );
  }
}

export class CommandListResponsesV4PagePagination extends V4PagePagination<CommandListResponse> {}

export interface CommandCreateResponse {
  /**
   * List of created commands
   */
  commands?: Array<CommandCreateResponse.Command>;
}

export namespace CommandCreateResponse {
  export interface Command {
    /**
     * Unique identifier for the command
     */
    id?: string;

    /**
     * Command arguments
     */
    args?: { [key: string]: string };

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

export namespace CommandListResponse {
  export interface Command {
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

export namespace CommandCreateParams {
  export interface Command {
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

  export namespace Command {
    export interface CommandArgs {
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

Commands.CommandListResponsesV4PagePagination = CommandListResponsesV4PagePagination;
Commands.Devices = Devices;
Commands.DeviceListResponsesV4PagePagination = DeviceListResponsesV4PagePagination;
Commands.Downloads = Downloads;
Commands.Quota = Quota;

export declare namespace Commands {
  export {
    type CommandCreateResponse as CommandCreateResponse,
    type CommandListResponse as CommandListResponse,
    CommandListResponsesV4PagePagination as CommandListResponsesV4PagePagination,
    type CommandCreateParams as CommandCreateParams,
    type CommandListParams as CommandListParams,
  };

  export {
    Devices as Devices,
    type DeviceListResponse as DeviceListResponse,
    DeviceListResponsesV4PagePagination as DeviceListResponsesV4PagePagination,
    type DeviceListParams as DeviceListParams,
  };

  export { Downloads as Downloads, type DownloadGetParams as DownloadGetParams };

  export { Quota as Quota, type QuotaGetResponse as QuotaGetResponse, type QuotaGetParams as QuotaGetParams };
}
