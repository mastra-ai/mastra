"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPProtocol = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
class HTTPProtocol extends resource_1.APIResource {
    get(httpProtocol, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.get(httpProtocol, {}, query);
        }
        return this._client.get(`/radar/http/top/locations/http_protocol/${httpProtocol}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.HTTPProtocol = HTTPProtocol;
//# sourceMappingURL=http-protocol.js.map