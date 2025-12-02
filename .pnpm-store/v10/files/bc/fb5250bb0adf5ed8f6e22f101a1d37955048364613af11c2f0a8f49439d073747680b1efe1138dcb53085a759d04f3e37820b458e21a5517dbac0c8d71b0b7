// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
export class IPs extends APIResource {
    timeseries(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.timeseries({}, query);
        }
        return this._client.get('/radar/bgp/ips/timeseries', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=ips.mjs.map