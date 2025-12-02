// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../../resource.mjs";
import { isRequestOptions } from "../../../../../../core.mjs";
export class Malicious extends APIResource {
    get(malicious, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get(malicious, {}, query);
        }
        return this._client.get(`/radar/email/security/top/tlds/malicious/${malicious}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=malicious.mjs.map