"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeseriesGroups = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
class TimeseriesGroups extends resource_1.APIResource {
    dnssec(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.dnssec({}, query);
        }
        return this._client.get('/radar/as112/timeseries_groups/dnssec', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    edns(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.edns({}, query);
        }
        return this._client.get('/radar/as112/timeseries_groups/edns', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    ipVersion(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.ipVersion({}, query);
        }
        return this._client.get('/radar/as112/timeseries_groups/ip_version', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    protocol(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.protocol({}, query);
        }
        return this._client.get('/radar/as112/timeseries_groups/protocol', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    queryType(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.queryType({}, query);
        }
        return this._client.get('/radar/as112/timeseries_groups/query_type', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    responseCodes(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.responseCodes({}, query);
        }
        return this._client.get('/radar/as112/timeseries_groups/response_codes', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.TimeseriesGroups = TimeseriesGroups;
//# sourceMappingURL=timeseries-groups.js.map