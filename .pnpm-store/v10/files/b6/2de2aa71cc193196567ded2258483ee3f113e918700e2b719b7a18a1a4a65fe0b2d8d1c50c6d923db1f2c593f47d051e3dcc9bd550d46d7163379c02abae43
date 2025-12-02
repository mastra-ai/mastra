"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternetServices = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
class InternetServices extends resource_1.APIResource {
    categories(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.categories({}, query);
        }
        return this._client.get('/radar/ranking/internet_services/categories', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    timeseriesGroups(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.timeseriesGroups({}, query);
        }
        return this._client.get('/radar/ranking/internet_services/timeseries_groups', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    top(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.top({}, query);
        }
        return this._client.get('/radar/ranking/internet_services/top', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.InternetServices = InternetServices;
//# sourceMappingURL=internet-services.js.map