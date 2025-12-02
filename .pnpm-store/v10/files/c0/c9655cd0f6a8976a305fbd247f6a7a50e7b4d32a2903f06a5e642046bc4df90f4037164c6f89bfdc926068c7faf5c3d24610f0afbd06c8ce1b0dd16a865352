// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
export class TimeseriesGroups extends APIResource {
    dnssec(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.dnssec({}, query);
        }
        return this._client.get('/radar/as112/timeseries_groups/dnssec', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    edns(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.edns({}, query);
        }
        return this._client.get('/radar/as112/timeseries_groups/edns', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    ipVersion(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.ipVersion({}, query);
        }
        return this._client.get('/radar/as112/timeseries_groups/ip_version', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    protocol(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.protocol({}, query);
        }
        return this._client.get('/radar/as112/timeseries_groups/protocol', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    queryType(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.queryType({}, query);
        }
        return this._client.get('/radar/as112/timeseries_groups/query_type', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    responseCodes(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.responseCodes({}, query);
        }
        return this._client.get('/radar/as112/timeseries_groups/response_codes', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=timeseries-groups.mjs.map