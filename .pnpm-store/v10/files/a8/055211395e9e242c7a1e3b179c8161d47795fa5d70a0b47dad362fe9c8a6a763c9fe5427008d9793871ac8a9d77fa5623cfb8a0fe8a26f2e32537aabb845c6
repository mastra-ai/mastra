// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import * as LocationsAPI from "./locations.mjs";
import { Locations as LocationsAPILocations } from "./locations.mjs";
export class TrafficAnomalies extends APIResource {
    constructor() {
        super(...arguments);
        this.locations = new LocationsAPI.Locations(this._client);
    }
    get(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get({}, query);
        }
        return this._client.get('/radar/traffic_anomalies', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
TrafficAnomalies.Locations = LocationsAPILocations;
//# sourceMappingURL=traffic-anomalies.mjs.map