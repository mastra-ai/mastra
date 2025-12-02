// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
export class TimeseriesGroups extends APIResource {
    botClass(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.botClass({}, query);
        }
        return this._client.get('/radar/leaked_credential_checks/timeseries_groups/bot_class', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    compromised(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.compromised({}, query);
        }
        return this._client.get('/radar/leaked_credential_checks/timeseries_groups/compromised', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=timeseries-groups.mjs.map