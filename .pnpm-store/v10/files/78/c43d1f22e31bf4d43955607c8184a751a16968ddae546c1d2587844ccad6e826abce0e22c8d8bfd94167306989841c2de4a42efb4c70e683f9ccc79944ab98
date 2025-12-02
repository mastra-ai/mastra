// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
export class IPVersion extends APIResource {
    get(ipVersion, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get(ipVersion, {}, query);
        }
        return this._client.get(`/radar/http/top/ases/ip_version/${ipVersion}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=ip-version.mjs.map