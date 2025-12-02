// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
export class Top extends APIResource {
    ases(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.ases({}, query);
        }
        return this._client.get('/radar/netflows/top/ases', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    locations(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.locations({}, query);
        }
        return this._client.get('/radar/netflows/top/locations', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=top.mjs.map