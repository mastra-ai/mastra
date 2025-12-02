// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
export class OS extends APIResource {
    get(os, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get(os, {}, query);
        }
        return this._client.get(`/radar/http/top/locations/os/${os}`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=os.mjs.map