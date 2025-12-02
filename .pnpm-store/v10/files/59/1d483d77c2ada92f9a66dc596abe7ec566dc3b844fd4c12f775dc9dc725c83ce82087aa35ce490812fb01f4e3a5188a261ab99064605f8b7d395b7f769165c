// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
export class HTTPMethod extends APIResource {
    get(httpVersion, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get(httpVersion, {}, query);
        }
        return this._client.get(`/radar/http/top/ases/http_version/${httpVersion}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=http-method.mjs.map