// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
export class Domain extends APIResource {
    get(domain, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get(domain, {}, query);
        }
        return this._client.get(`/radar/ranking/domain/${domain}`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=domain.mjs.map