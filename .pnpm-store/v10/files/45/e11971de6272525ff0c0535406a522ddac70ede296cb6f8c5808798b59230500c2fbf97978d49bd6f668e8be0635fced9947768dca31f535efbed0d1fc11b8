// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
export class Locations extends APIResource {
    list(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.list({}, query);
        }
        return this._client.get('/radar/entities/locations', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    get(location, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get(location, {}, query);
        }
        return this._client.get(`/radar/entities/locations/${location}`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=locations.mjs.map