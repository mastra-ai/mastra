// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as AggregatesAPI from "./aggregates/aggregates.mjs";
import { Aggregates } from "./aggregates/aggregates.mjs";
import * as EventsAPI from "./events/events.mjs";
import { Events } from "./events/events.mjs";
export class Analytics extends APIResource {
    constructor() {
        super(...arguments);
        this.aggregates = new AggregatesAPI.Aggregates(this._client);
        this.events = new EventsAPI.Events(this._client);
    }
}
Analytics.Aggregates = Aggregates;
Analytics.Events = Events;
//# sourceMappingURL=analytics.mjs.map