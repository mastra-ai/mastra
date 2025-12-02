"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Locations = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
class Locations extends resource_1.APIResource {
    list(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.get('/radar/entities/locations', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    get(location, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.get(location, {}, query);
        }
        return this._client.get(`/radar/entities/locations/${location}`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Locations = Locations;
//# sourceMappingURL=locations.js.map