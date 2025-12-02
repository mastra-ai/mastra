// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
export class Summary extends APIResource {
    dnssec(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.dnssec({}, query);
        }
        return this._client.get('/radar/as112/summary/dnssec', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    edns(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.edns({}, query);
        }
        return this._client.get('/radar/as112/summary/edns', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    ipVersion(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.ipVersion({}, query);
        }
        return this._client.get('/radar/as112/summary/ip_version', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    protocol(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.protocol({}, query);
        }
        return this._client.get('/radar/as112/summary/protocol', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    queryType(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.queryType({}, query);
        }
        return this._client.get('/radar/as112/summary/query_type', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    responseCodes(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.responseCodes({}, query);
        }
        return this._client.get('/radar/as112/summary/response_codes', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=summary.mjs.map