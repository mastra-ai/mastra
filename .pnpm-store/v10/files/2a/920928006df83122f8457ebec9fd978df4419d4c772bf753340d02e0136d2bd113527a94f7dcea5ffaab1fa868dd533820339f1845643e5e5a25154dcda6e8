"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceListResponsesCursorPagination = exports.Devices = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Devices extends resource_1.APIResource {
    /**
     * Lists WARP devices.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const deviceListResponse of client.zeroTrust.devices.devices.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/physical-devices`, DeviceListResponsesCursorPagination, { query, ...options });
    }
    /**
     * Deletes a WARP device.
     *
     * @example
     * ```ts
     * const device =
     *   await client.zeroTrust.devices.devices.delete(
     *     'device_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(deviceId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/devices/physical-devices/${deviceId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a single WARP device.
     *
     * @example
     * ```ts
     * const device = await client.zeroTrust.devices.devices.get(
     *   'device_id',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(deviceId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/devices/physical-devices/${deviceId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Revokes all WARP registrations associated with the specified device.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.devices.devices.revoke(
     *     'device_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    revoke(deviceId, params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/devices/physical-devices/${deviceId}/revoke`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Devices = Devices;
class DeviceListResponsesCursorPagination extends pagination_1.CursorPagination {
}
exports.DeviceListResponsesCursorPagination = DeviceListResponsesCursorPagination;
Devices.DeviceListResponsesCursorPagination = DeviceListResponsesCursorPagination;
//# sourceMappingURL=devices_.js.map