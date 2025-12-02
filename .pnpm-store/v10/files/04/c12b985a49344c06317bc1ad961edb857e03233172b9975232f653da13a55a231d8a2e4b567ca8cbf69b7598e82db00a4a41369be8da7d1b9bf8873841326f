// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../../resource.mjs";
import { isRequestOptions } from "../../../../../../core.mjs";
export class Spam extends APIResource {
    get(spam, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get(spam, {}, query);
        }
        return this._client.get(`/radar/email/security/top/tlds/spam/${spam}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=spam.mjs.map