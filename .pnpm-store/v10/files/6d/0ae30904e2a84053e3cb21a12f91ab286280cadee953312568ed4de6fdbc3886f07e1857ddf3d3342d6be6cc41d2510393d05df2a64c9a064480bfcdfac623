// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
export class Summary extends APIResource {
    model(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.model({}, query);
        }
        return this._client.get('/radar/ai/inference/summary/model', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    task(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.task({}, query);
        }
        return this._client.get('/radar/ai/inference/summary/task', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=summary.mjs.map