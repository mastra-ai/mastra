// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import * as SummaryAPI from "./summary.mjs";
import { Summary, } from "./summary.mjs";
import * as TimeseriesGroupsAPI from "./timeseries-groups.mjs";
import { TimeseriesGroups, } from "./timeseries-groups.mjs";
import * as TopAPI from "./top.mjs";
import { Top } from "./top.mjs";
export class DNS extends APIResource {
    constructor() {
        super(...arguments);
        this.top = new TopAPI.Top(this._client);
        this.summary = new SummaryAPI.Summary(this._client);
        this.timeseriesGroups = new TimeseriesGroupsAPI.TimeseriesGroups(this._client);
    }
    timeseries(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.timeseries({}, query);
        }
        return this._client.get('/radar/dns/timeseries', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
DNS.Top = Top;
DNS.Summary = Summary;
DNS.TimeseriesGroups = TimeseriesGroups;
//# sourceMappingURL=dns.mjs.map