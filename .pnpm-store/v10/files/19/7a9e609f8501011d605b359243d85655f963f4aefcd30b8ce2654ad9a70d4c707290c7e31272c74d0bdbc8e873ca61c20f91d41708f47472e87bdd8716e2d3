// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
export class InternetServices extends APIResource {
    categories(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.categories({}, query);
        }
        return this._client.get('/radar/ranking/internet_services/categories', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    timeseriesGroups(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.timeseriesGroups({}, query);
        }
        return this._client.get('/radar/ranking/internet_services/timeseries_groups', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    top(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.top({}, query);
        }
        return this._client.get('/radar/ranking/internet_services/top', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=internet-services.mjs.map