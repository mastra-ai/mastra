// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import * as OutagesAPI from "./outages.mjs";
import { Outages, } from "./outages.mjs";
export class Annotations extends APIResource {
    constructor() {
        super(...arguments);
        this.outages = new OutagesAPI.Outages(this._client);
    }
    list(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.list({}, query);
        }
        return this._client.get('/radar/annotations', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
Annotations.Outages = Outages;
//# sourceMappingURL=annotations.mjs.map