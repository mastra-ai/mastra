"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.OS = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
class OS extends resource_1.APIResource {
    get(os, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.get(os, {}, query);
        }
        return this._client.get(`/radar/http/top/ases/os/${os}`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.OS = OS;
//# sourceMappingURL=os.js.map