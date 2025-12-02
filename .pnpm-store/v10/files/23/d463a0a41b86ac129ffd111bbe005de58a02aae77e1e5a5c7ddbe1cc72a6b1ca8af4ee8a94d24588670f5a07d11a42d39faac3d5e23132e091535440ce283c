// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../resource.mjs";
import { isRequestOptions } from "../../../../../core.mjs";
import * as LocationsAPI from "./locations.mjs";
import { Locations, } from "./locations.mjs";
export class Top extends APIResource {
    constructor() {
        super(...arguments);
        this.locations = new LocationsAPI.Locations(this._client);
    }
    attacks(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.attacks({}, query);
        }
        return this._client.get('/radar/attacks/layer3/top/attacks', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    industry(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.industry({}, query);
        }
        return this._client.get('/radar/attacks/layer3/top/industry', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    vertical(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.vertical({}, query);
        }
        return this._client.get('/radar/attacks/layer3/top/vertical', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
Top.Locations = Locations;
//# sourceMappingURL=top.mjs.map