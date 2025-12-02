// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as RequestsAPI from "./requests/requests.mjs";
import { ListItemsSinglePage, RequestTypesResponsesSinglePage, Requests, } from "./requests/requests.mjs";
import * as ScansAPI from "./scans/scans.mjs";
import { Scans } from "./scans/scans.mjs";
import * as ThreatEventsAPI from "./threat-events/threat-events.mjs";
import { ThreatEvents, } from "./threat-events/threat-events.mjs";
export class CloudforceOne extends APIResource {
    constructor() {
        super(...arguments);
        this.scans = new ScansAPI.Scans(this._client);
        this.requests = new RequestsAPI.Requests(this._client);
        this.threatEvents = new ThreatEventsAPI.ThreatEvents(this._client);
    }
}
CloudforceOne.Scans = Scans;
CloudforceOne.Requests = Requests;
CloudforceOne.ListItemsSinglePage = ListItemsSinglePage;
CloudforceOne.RequestTypesResponsesSinglePage = RequestTypesResponsesSinglePage;
CloudforceOne.ThreatEvents = ThreatEvents;
//# sourceMappingURL=cloudforce-one.mjs.map