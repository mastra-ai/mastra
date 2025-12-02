// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
export class Ases extends APIResource {
    get(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get({}, query);
        }
        return this._client.get('/radar/bgp/top/ases', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    prefixes(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.prefixes({}, query);
        }
        return this._client.get('/radar/bgp/top/ases/prefixes', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=ases.mjs.map