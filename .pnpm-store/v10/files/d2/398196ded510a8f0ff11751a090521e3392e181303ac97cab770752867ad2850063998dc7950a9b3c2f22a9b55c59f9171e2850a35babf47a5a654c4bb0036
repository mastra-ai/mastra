// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as DevicesAPI from "./devices.mjs";
import { DeviceListResponsesV4PagePagination, Devices, } from "./devices.mjs";
import * as DownloadsAPI from "./downloads.mjs";
import { Downloads } from "./downloads.mjs";
import * as QuotaAPI from "./quota.mjs";
import { Quota } from "./quota.mjs";
import { V4PagePagination } from "../../../../pagination.mjs";
export class Commands extends APIResource {
    constructor() {
        super(...arguments);
        this.devices = new DevicesAPI.Devices(this._client);
        this.downloads = new DownloadsAPI.Downloads(this._client);
        this.quota = new QuotaAPI.Quota(this._client);
    }
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
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/dex/commands`, { body, ...options })._thenUnwrap((obj) => obj.result);
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
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/dex/commands`, CommandListResponsesV4PagePagination, { query, ...options });
    }
}
export class CommandListResponsesV4PagePagination extends V4PagePagination {
}
Commands.CommandListResponsesV4PagePagination = CommandListResponsesV4PagePagination;
Commands.Devices = Devices;
Commands.DeviceListResponsesV4PagePagination = DeviceListResponsesV4PagePagination;
Commands.Downloads = Downloads;
Commands.Quota = Quota;
//# sourceMappingURL=commands.mjs.map