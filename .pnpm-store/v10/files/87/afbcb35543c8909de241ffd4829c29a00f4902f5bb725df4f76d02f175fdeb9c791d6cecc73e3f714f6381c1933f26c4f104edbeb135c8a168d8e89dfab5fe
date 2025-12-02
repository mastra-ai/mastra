"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPs = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
class IPs extends resource_1.APIResource {
    timeseries(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.timeseries({}, query);
        }
        return this._client.get('/radar/bgp/ips/timeseries', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.IPs = IPs;
//# sourceMappingURL=ips.js.map