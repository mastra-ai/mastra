// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
export class Top extends APIResource {
    bots(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.bots({}, query);
        }
        return this._client.get('/radar/verified_bots/top/bots', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    categories(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.categories({}, query);
        }
        return this._client.get('/radar/verified_bots/top/categories', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=top.mjs.map