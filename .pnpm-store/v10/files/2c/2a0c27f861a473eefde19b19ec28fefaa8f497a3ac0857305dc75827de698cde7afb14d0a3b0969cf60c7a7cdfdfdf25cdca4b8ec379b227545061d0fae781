// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
import * as AsesAPI from "./ases.mjs";
import { Ases } from "./ases.mjs";
export class Top extends APIResource {
    constructor() {
        super(...arguments);
        this.ases = new AsesAPI.Ases(this._client);
    }
    prefixes(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.prefixes({}, query);
        }
        return this._client.get('/radar/bgp/top/prefixes', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
Top.Ases = Ases;
//# sourceMappingURL=top.mjs.map