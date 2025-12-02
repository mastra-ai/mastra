"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Outages = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
class Outages extends resource_1.APIResource {
    get(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.get({}, query);
        }
        return this._client.get('/radar/annotations/outages', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    locations(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.locations({}, query);
        }
        return this._client.get('/radar/annotations/outages/locations', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Outages = Outages;
//# sourceMappingURL=outages.js.map