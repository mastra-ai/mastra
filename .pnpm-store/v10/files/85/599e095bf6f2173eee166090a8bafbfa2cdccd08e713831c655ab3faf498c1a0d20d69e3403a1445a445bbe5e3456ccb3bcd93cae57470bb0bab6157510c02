// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import * as SummaryAPI from "./summary.mjs";
import { Summary, } from "./summary.mjs";
import * as TimeseriesGroupsAPI from "./timeseries-groups.mjs";
import { TimeseriesGroups, } from "./timeseries-groups.mjs";
import * as TopAPI from "./top.mjs";
import { Top, } from "./top.mjs";
export class AS112 extends APIResource {
    constructor() {
        super(...arguments);
        this.summary = new SummaryAPI.Summary(this._client);
        this.timeseriesGroups = new TimeseriesGroupsAPI.TimeseriesGroups(this._client);
        this.top = new TopAPI.Top(this._client);
    }
    timeseries(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.timeseries({}, query);
        }
        return this._client.get('/radar/as112/timeseries', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
AS112.Summary = Summary;
AS112.TimeseriesGroups = TimeseriesGroups;
AS112.Top = Top;
//# sourceMappingURL=as112.mjs.map