// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
export class Summary extends APIResource {
    httpMethod(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.httpMethod({}, query);
        }
        return this._client.get('/radar/attacks/layer7/summary/http_method', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    httpVersion(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.httpVersion({}, query);
        }
        return this._client.get('/radar/attacks/layer7/summary/http_version', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    industry(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.industry({}, query);
        }
        return this._client.get('/radar/attacks/layer7/summary/industry', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    ipVersion(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.ipVersion({}, query);
        }
        return this._client.get('/radar/attacks/layer7/summary/ip_version', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    managedRules(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.managedRules({}, query);
        }
        return this._client.get('/radar/attacks/layer7/summary/managed_rules', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    mitigationProduct(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.mitigationProduct({}, query);
        }
        return this._client.get('/radar/attacks/layer7/summary/mitigation_product', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    vertical(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.vertical({}, query);
        }
        return this._client.get('/radar/attacks/layer7/summary/vertical', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=summary.mjs.map