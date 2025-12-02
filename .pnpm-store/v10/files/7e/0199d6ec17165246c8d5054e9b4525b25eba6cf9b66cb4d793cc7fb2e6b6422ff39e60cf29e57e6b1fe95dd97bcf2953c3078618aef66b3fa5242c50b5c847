"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Summary = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
class Summary extends resource_1.APIResource {
    dnssec(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.dnssec({}, query);
        }
        return this._client.get('/radar/as112/summary/dnssec', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    edns(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.edns({}, query);
        }
        return this._client.get('/radar/as112/summary/edns', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    ipVersion(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.ipVersion({}, query);
        }
        return this._client.get('/radar/as112/summary/ip_version', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    protocol(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.protocol({}, query);
        }
        return this._client.get('/radar/as112/summary/protocol', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    queryType(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.queryType({}, query);
        }
        return this._client.get('/radar/as112/summary/query_type', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    responseCodes(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.responseCodes({}, query);
        }
        return this._client.get('/radar/as112/summary/response_codes', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Summary = Summary;
//# sourceMappingURL=summary.js.map