"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPVersion = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
class IPVersion extends resource_1.APIResource {
    get(ipVersion, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.get(ipVersion, {}, query);
        }
        return this._client.get(`/radar/http/top/ases/ip_version/${ipVersion}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.IPVersion = IPVersion;
//# sourceMappingURL=ip-version.js.map