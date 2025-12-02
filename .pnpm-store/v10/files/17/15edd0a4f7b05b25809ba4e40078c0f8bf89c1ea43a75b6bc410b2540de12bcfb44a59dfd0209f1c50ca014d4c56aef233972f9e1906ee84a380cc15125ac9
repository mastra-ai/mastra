// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
import * as SummaryAPI from "./summary.mjs";
import { Summary, } from "./summary.mjs";
import * as TimeseriesGroupsAPI from "./timeseries-groups.mjs";
import { TimeseriesGroups, } from "./timeseries-groups.mjs";
import * as TopAPI from "./top/top.mjs";
import { Top, } from "./top/top.mjs";
export class Layer3 extends APIResource {
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
        return this._client.get('/radar/attacks/layer3/timeseries', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
Layer3.Summary = Summary;
Layer3.TimeseriesGroups = TimeseriesGroups;
Layer3.Top = Top;
//# sourceMappingURL=layer3.mjs.map