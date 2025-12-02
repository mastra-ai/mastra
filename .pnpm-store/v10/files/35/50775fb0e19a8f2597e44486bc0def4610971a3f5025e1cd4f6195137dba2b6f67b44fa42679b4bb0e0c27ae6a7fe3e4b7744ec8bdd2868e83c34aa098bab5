// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
export class HTTPProtocol extends APIResource {
    get(httpProtocol, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get(httpProtocol, {}, query);
        }
        return this._client.get(`/radar/http/top/locations/http_protocol/${httpProtocol}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=http-protocol.mjs.map