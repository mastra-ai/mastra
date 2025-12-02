// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { V4PagePagination } from "../../../../pagination.mjs";
export class Devices extends APIResource {
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
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/dex/commands/devices`, DeviceListResponsesV4PagePagination, { query, ...options });
    }
}
export class DeviceListResponsesV4PagePagination extends V4PagePagination {
}
Devices.DeviceListResponsesV4PagePagination = DeviceListResponsesV4PagePagination;
//# sourceMappingURL=devices.mjs.map