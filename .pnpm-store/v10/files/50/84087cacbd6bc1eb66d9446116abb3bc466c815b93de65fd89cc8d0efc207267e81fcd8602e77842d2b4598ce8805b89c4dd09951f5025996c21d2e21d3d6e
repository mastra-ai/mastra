"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ases = void 0;
const resource_1 = require("../../../../../resource.js");
const core_1 = require("../../../../../core.js");
class Ases extends resource_1.APIResource {
    origin(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.origin({}, query);
        }
        return this._client.get('/radar/attacks/layer7/top/ases/origin', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Ases = Ases;
//# sourceMappingURL=ases.js.map