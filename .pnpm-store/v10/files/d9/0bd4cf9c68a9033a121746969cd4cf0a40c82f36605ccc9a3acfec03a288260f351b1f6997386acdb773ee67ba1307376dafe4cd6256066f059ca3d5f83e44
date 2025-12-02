// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../resource.mjs";
import { isRequestOptions } from "../core.mjs";
export class Status extends APIResource {
    getStatus(body = {}, options) {
        if (isRequestOptions(body)) {
            return this.getStatus({}, body);
        }
        return this._client.post('/status/get-status', { body, ...options });
    }
}
//# sourceMappingURL=status.mjs.map