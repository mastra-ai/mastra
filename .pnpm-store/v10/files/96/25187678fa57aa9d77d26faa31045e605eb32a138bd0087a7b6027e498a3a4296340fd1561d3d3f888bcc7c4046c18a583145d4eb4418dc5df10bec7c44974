// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
export class BrowserFamily extends APIResource {
    get(browserFamily, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get(browserFamily, {}, query);
        }
        return this._client.get(`/radar/http/top/locations/browser_family/${browserFamily}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=browser-family.mjs.map