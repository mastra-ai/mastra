"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetStatus = void 0;
const resource_1 = require("../../../../resource.js");
const DevicesAPI = __importStar(require("./devices.js"));
const devices_1 = require("./devices.js");
class FleetStatus extends resource_1.APIResource {
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
exports.FleetStatus = FleetStatus;
FleetStatus.Devices = devices_1.Devices;
FleetStatus.DeviceListResponsesV4PagePaginationArray = devices_1.DeviceListResponsesV4PagePaginationArray;
//# sourceMappingURL=fleet-status.js.map