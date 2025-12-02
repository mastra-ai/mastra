// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
export class TimeseriesGroups extends APIResource {
    userAgent(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.userAgent({}, query);
        }
        return this._client.get('/radar/ai/bots/timeseries_groups/user_agent', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=timeseries-groups.mjs.map