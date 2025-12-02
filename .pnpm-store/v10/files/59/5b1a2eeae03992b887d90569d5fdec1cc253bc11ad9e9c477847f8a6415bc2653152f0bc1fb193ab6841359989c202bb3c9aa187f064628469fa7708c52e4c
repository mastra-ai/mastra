// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
export class TLSVersion extends APIResource {
    get(tlsVersion, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get(tlsVersion, {}, query);
        }
        return this._client.get(`/radar/http/top/locations/tls_version/${tlsVersion}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=tls-version.mjs.map