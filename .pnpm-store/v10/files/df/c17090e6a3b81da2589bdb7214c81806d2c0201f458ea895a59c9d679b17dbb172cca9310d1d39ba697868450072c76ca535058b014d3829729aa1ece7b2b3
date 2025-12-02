// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as AvailableAlertsAPI from "./available-alerts.mjs";
import { AvailableAlerts } from "./available-alerts.mjs";
import * as HistoryAPI from "./history.mjs";
import { HistoriesV4PagePaginationArray, HistoryResource } from "./history.mjs";
import * as PoliciesAPI from "./policies.mjs";
import { Policies, PoliciesSinglePage, } from "./policies.mjs";
import * as DestinationsAPI from "./destinations/destinations.mjs";
import { Destinations } from "./destinations/destinations.mjs";
export class Alerting extends APIResource {
    constructor() {
        super(...arguments);
        this.availableAlerts = new AvailableAlertsAPI.AvailableAlerts(this._client);
        this.destinations = new DestinationsAPI.Destinations(this._client);
        this.history = new HistoryAPI.HistoryResource(this._client);
        this.policies = new PoliciesAPI.Policies(this._client);
    }
}
Alerting.AvailableAlerts = AvailableAlerts;
Alerting.Destinations = Destinations;
Alerting.HistoryResource = HistoryResource;
Alerting.HistoriesV4PagePaginationArray = HistoriesV4PagePaginationArray;
Alerting.Policies = Policies;
Alerting.PoliciesSinglePage = PoliciesSinglePage;
//# sourceMappingURL=alerting.mjs.map