// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as DevicesAPI from "./devices.mjs";
import { DeviceListResponsesV4PagePaginationArray, Devices, } from "./devices.mjs";
export class FleetStatus extends APIResource {
    constructor() {
        super(...arguments);
        this.devices = new DevicesAPI.Devices(this._client);
    }
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
    live(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/dex/fleet-status/live`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
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
    overTime(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/dex/fleet-status/over-time`, {
            query,
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
}
FleetStatus.Devices = Devices;
FleetStatus.DeviceListResponsesV4PagePaginationArray = DeviceListResponsesV4PagePaginationArray;
//# sourceMappingURL=fleet-status.mjs.map