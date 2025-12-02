// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
export class Routes extends APIResource {
    ases(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.ases({}, query);
        }
        return this._client.get('/radar/bgp/routes/ases', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    moas(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.moas({}, query);
        }
        return this._client.get('/radar/bgp/routes/moas', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    pfx2as(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.pfx2as({}, query);
        }
        return this._client.get('/radar/bgp/routes/pfx2as', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    realtime(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.realtime({}, query);
        }
        return this._client.get('/radar/bgp/routes/realtime', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    stats(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.stats({}, query);
        }
        return this._client.get('/radar/bgp/routes/stats', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=routes.mjs.map