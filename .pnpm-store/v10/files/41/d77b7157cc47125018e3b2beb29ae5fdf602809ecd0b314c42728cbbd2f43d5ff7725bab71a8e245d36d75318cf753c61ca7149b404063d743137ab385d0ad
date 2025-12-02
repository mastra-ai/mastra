"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetStatus = void 0;
const resource_1 = require("../../../resource.js");
class FleetStatus extends resource_1.APIResource {
    /**
     * Get the live status of a latest device given device_id from the device_state
     * table
     *
     * @example
     * ```ts
     * const fleetStatus =
     *   await client.zeroTrust.devices.fleetStatus.get(
     *     'cb49c27f-7f97-49c5-b6f3-f7c01ead0fd7',
     *     {
     *       account_id: '01a7362d577a6c3019a474fd6f485823',
     *       since_minutes: 10,
     *     },
     *   );
     * ```
     */
    get(deviceId, params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/dex/devices/${deviceId}/fleet-status/live`, {
            query,
            ...options,
        });
    }
}
exports.FleetStatus = FleetStatus;
//# sourceMappingURL=fleet-status.js.map