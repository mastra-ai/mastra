"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ases = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
class Ases extends resource_1.APIResource {
    get(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.get({}, query);
        }
        return this._client.get('/radar/bgp/top/ases', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    prefixes(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.prefixes({}, query);
        }
        return this._client.get('/radar/bgp/top/ases/prefixes', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Ases = Ases;
//# sourceMappingURL=ases.js.map