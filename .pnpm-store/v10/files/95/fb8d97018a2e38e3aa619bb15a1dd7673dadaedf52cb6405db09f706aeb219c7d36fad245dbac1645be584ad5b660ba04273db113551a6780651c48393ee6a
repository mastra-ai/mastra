// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import * as SummaryAPI from "./summary.mjs";
import { Summary, } from "./summary.mjs";
import * as TimeseriesGroupsAPI from "./timeseries-groups.mjs";
import { TimeseriesGroups, } from "./timeseries-groups.mjs";
import * as TopAPI from "./top.mjs";
import { Top, } from "./top.mjs";
import * as AsesAPI from "./ases/ases.mjs";
import { Ases } from "./ases/ases.mjs";
import * as LocationsAPI from "./locations/locations.mjs";
import { Locations } from "./locations/locations.mjs";
export class HTTP extends APIResource {
    constructor() {
        super(...arguments);
        this.locations = new LocationsAPI.Locations(this._client);
        this.ases = new AsesAPI.Ases(this._client);
        this.summary = new SummaryAPI.Summary(this._client);
        this.timeseriesGroups = new TimeseriesGroupsAPI.TimeseriesGroups(this._client);
        this.top = new TopAPI.Top(this._client);
    }
    timeseries(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.timeseries({}, query);
        }
        return this._client.get('/radar/http/timeseries', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
HTTP.Locations = Locations;
HTTP.Ases = Ases;
HTTP.Summary = Summary;
HTTP.TimeseriesGroups = TimeseriesGroups;
HTTP.Top = Top;
//# sourceMappingURL=http.mjs.map