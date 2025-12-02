// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
export class WebCrawlers extends APIResource {
    summary(dimension, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.summary(dimension, {}, query);
        }
        return this._client.get(`/radar/bots/crawlers/summary/${dimension}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    timeseriesGroups(dimension, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.timeseriesGroups(dimension, {}, query);
        }
        return this._client.get(`/radar/bots/crawlers/timeseries_groups/${dimension}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=web-crawlers.mjs.map