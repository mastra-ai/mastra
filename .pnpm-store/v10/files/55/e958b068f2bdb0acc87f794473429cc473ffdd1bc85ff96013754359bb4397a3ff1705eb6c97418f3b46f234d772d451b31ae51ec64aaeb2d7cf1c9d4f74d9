"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Top = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
class Top extends resource_1.APIResource {
    ases(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.ases({}, query);
        }
        return this._client.get('/radar/quality/speed/top/ases', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    locations(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.locations({}, query);
        }
        return this._client.get('/radar/quality/speed/top/locations', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Top = Top;
//# sourceMappingURL=top.js.map