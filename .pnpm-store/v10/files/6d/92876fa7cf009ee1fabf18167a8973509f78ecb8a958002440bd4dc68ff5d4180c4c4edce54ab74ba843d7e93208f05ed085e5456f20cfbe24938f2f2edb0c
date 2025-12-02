"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceType = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
class DeviceType extends resource_1.APIResource {
    get(deviceType, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.get(deviceType, {}, query);
        }
        return this._client.get(`/radar/http/top/locations/device_type/${deviceType}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.DeviceType = DeviceType;
//# sourceMappingURL=device-type.js.map