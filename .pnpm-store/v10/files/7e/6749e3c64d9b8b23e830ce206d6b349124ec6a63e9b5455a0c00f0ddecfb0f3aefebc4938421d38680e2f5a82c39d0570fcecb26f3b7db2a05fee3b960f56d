// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
export class Top extends APIResource {
    browser(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.browser({}, query);
        }
        return this._client.get('/radar/http/top/browser', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    browserFamily(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.browserFamily({}, query);
        }
        return this._client.get('/radar/http/top/browser_family', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=top.mjs.map