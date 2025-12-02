// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
export class Outages extends APIResource {
    get(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get({}, query);
        }
        return this._client.get('/radar/annotations/outages', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    locations(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.locations({}, query);
        }
        return this._client.get('/radar/annotations/outages/locations', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=outages.mjs.map