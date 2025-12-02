"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TLSVersion = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
class TLSVersion extends resource_1.APIResource {
    get(tlsVersion, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.get(tlsVersion, {}, query);
        }
        return this._client.get(`/radar/http/top/locations/tls_version/${tlsVersion}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.TLSVersion = TLSVersion;
//# sourceMappingURL=tls-version.js.map