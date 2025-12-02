// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import * as DomainAPI from "./domain.mjs";
import { Domain } from "./domain.mjs";
import * as InternetServicesAPI from "./internet-services.mjs";
import { InternetServices, } from "./internet-services.mjs";
export class Ranking extends APIResource {
    constructor() {
        super(...arguments);
        this.domain = new DomainAPI.Domain(this._client);
        this.internetServices = new InternetServicesAPI.InternetServices(this._client);
    }
    timeseriesGroups(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.timeseriesGroups({}, query);
        }
        return this._client.get('/radar/ranking/timeseries_groups', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    top(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.top({}, query);
        }
        return this._client.get('/radar/ranking/top', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
Ranking.Domain = Domain;
Ranking.InternetServices = InternetServices;
//# sourceMappingURL=ranking.mjs.map