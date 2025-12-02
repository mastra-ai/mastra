"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Routes = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
class Routes extends resource_1.APIResource {
    ases(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.ases({}, query);
        }
        return this._client.get('/radar/bgp/routes/ases', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    moas(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.moas({}, query);
        }
        return this._client.get('/radar/bgp/routes/moas', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    pfx2as(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.pfx2as({}, query);
        }
        return this._client.get('/radar/bgp/routes/pfx2as', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    realtime(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.realtime({}, query);
        }
        return this._client.get('/radar/bgp/routes/realtime', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    stats(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.stats({}, query);
        }
        return this._client.get('/radar/bgp/routes/stats', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Routes = Routes;
//# sourceMappingURL=routes.js.map