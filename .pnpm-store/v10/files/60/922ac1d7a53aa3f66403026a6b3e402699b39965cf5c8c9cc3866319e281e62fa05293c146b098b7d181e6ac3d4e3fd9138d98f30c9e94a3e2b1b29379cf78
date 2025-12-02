// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { V4PagePaginationArray } from "../../../../pagination.mjs";
export class Devices extends APIResource {
    /**
     * List details for devices using WARP
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const deviceListResponse of client.zeroTrust.dex.fleetStatus.devices.list(
     *   {
     *     account_id: '01a7362d577a6c3019a474fd6f485823',
     *     from: '2023-10-11T00:00:00Z',
     *     page: 1,
     *     per_page: 10,
     *     to: '2023-10-11T00:00:00Z',
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/dex/fleet-status/devices`, DeviceListResponsesV4PagePaginationArray, { query, ...options });
    }
}
export class DeviceListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Devices.DeviceListResponsesV4PagePaginationArray = DeviceListResponsesV4PagePaginationArray;
//# sourceMappingURL=devices.mjs.map