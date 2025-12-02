// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as SummaryAPI from "./summary.mjs";
import { Summary, } from "./summary.mjs";
import * as TimeseriesGroupsAPI from "./timeseries-groups.mjs";
import { TimeseriesGroups, } from "./timeseries-groups.mjs";
import * as TopAPI from "./top/top.mjs";
import { Top } from "./top/top.mjs";
export class Security extends APIResource {
    constructor() {
        super(...arguments);
        this.top = new TopAPI.Top(this._client);
        this.summary = new SummaryAPI.Summary(this._client);
        this.timeseriesGroups = new TimeseriesGroupsAPI.TimeseriesGroups(this._client);
    }
}
Security.Top = Top;
Security.Summary = Summary;
Security.TimeseriesGroups = TimeseriesGroups;
//# sourceMappingURL=security.mjs.map