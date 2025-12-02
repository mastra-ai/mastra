"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Top = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
class Top extends resource_1.APIResource {
    dnssec(dnssec, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.dnssec(dnssec, {}, query);
        }
        return this._client.get(`/radar/as112/top/locations/dnssec/${dnssec}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    edns(edns, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.edns(edns, {}, query);
        }
        return this._client.get(`/radar/as112/top/locations/edns/${edns}`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    ipVersion(ipVersion, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.ipVersion(ipVersion, {}, query);
        }
        return this._client.get(`/radar/as112/top/locations/ip_version/${ipVersion}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    locations(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.locations({}, query);
        }
        return this._client.get('/radar/as112/top/locations', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Top = Top;
//# sourceMappingURL=top.js.map