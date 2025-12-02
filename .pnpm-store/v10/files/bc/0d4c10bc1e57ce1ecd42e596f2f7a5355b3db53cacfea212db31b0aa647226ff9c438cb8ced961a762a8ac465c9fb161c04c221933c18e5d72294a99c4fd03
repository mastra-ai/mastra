"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Summary = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
class Summary extends resource_1.APIResource {
    httpMethod(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.httpMethod({}, query);
        }
        return this._client.get('/radar/attacks/layer7/summary/http_method', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    httpVersion(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.httpVersion({}, query);
        }
        return this._client.get('/radar/attacks/layer7/summary/http_version', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    industry(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.industry({}, query);
        }
        return this._client.get('/radar/attacks/layer7/summary/industry', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    ipVersion(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.ipVersion({}, query);
        }
        return this._client.get('/radar/attacks/layer7/summary/ip_version', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    managedRules(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.managedRules({}, query);
        }
        return this._client.get('/radar/attacks/layer7/summary/managed_rules', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    mitigationProduct(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.mitigationProduct({}, query);
        }
        return this._client.get('/radar/attacks/layer7/summary/mitigation_product', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    vertical(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.vertical({}, query);
        }
        return this._client.get('/radar/attacks/layer7/summary/vertical', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Summary = Summary;
//# sourceMappingURL=summary.js.map