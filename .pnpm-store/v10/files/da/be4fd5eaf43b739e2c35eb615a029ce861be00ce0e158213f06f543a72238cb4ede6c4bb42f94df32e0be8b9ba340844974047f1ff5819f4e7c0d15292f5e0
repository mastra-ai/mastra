// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../resource.mjs";
import { isRequestOptions } from "../../../../../core.mjs";
export class Ases extends APIResource {
    origin(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.origin({}, query);
        }
        return this._client.get('/radar/attacks/layer7/top/ases/origin', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=ases.mjs.map