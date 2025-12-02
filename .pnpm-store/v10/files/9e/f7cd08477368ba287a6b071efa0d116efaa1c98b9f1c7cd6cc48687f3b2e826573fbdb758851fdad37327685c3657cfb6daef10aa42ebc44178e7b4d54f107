// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { isRequestOptions } from "../../core.mjs";
export class TCPResetsTimeouts extends APIResource {
    summary(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.summary({}, query);
        }
        return this._client.get('/radar/tcp_resets_timeouts/summary', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    timeseriesGroups(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.timeseriesGroups({}, query);
        }
        return this._client.get('/radar/tcp_resets_timeouts/timeseries_groups', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=tcp-resets-timeouts.mjs.map