"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPMethod = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
class HTTPMethod extends resource_1.APIResource {
    get(httpVersion, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.get(httpVersion, {}, query);
        }
        return this._client.get(`/radar/http/top/locations/http_version/${httpVersion}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.HTTPMethod = HTTPMethod;
//# sourceMappingURL=http-method.js.map