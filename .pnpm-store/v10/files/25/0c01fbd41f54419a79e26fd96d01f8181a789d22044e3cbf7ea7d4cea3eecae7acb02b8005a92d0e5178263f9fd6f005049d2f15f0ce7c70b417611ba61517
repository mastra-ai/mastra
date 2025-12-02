// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
export class Top extends APIResource {
    dnssec(dnssec, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.dnssec(dnssec, {}, query);
        }
        return this._client.get(`/radar/as112/top/locations/dnssec/${dnssec}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    edns(edns, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.edns(edns, {}, query);
        }
        return this._client.get(`/radar/as112/top/locations/edns/${edns}`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    ipVersion(ipVersion, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.ipVersion(ipVersion, {}, query);
        }
        return this._client.get(`/radar/as112/top/locations/ip_version/${ipVersion}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    locations(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.locations({}, query);
        }
        return this._client.get('/radar/as112/top/locations', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=top.mjs.map