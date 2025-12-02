// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../../resource.mjs";
import { isRequestOptions } from "../../../../../../core.mjs";
export class Spoof extends APIResource {
    get(spoof, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get(spoof, {}, query);
        }
        return this._client.get(`/radar/email/security/top/tlds/spoof/${spoof}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=spoof.mjs.map