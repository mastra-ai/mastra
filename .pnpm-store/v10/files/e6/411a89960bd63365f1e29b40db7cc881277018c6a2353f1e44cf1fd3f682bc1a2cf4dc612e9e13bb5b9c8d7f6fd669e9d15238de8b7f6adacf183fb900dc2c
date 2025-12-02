// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
export class Locations extends APIResource {
    get(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get({}, query);
        }
        return this._client.get('/radar/traffic_anomalies/locations', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=locations.mjs.map