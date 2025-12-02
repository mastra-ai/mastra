// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../resource.mjs";
import { isRequestOptions } from "../../../../../core.mjs";
export class Locations extends APIResource {
    origin(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.origin({}, query);
        }
        return this._client.get('/radar/attacks/layer3/top/locations/origin', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    target(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.target({}, query);
        }
        return this._client.get('/radar/attacks/layer3/top/locations/target', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=locations.mjs.map