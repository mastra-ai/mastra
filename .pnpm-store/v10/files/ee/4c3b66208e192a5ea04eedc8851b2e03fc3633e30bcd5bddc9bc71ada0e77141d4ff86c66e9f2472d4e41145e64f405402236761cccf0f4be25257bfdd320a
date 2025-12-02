// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
export class Summary extends APIResource {
    userAgent(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.userAgent({}, query);
        }
        return this._client.get('/radar/ai/bots/summary/user_agent', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=summary.mjs.map