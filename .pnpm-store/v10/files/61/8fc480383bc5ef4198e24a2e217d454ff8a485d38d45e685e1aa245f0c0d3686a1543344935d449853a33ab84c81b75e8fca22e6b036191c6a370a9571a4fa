"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventListResponsesV4PagePagination = exports.Events = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
const pagination_1 = require("../../../../pagination.js");
class Events extends resource_1.APIResource {
    list(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/radar/bgp/hijacks/events', EventListResponsesV4PagePagination, {
            query,
            ...options,
        });
    }
}
exports.Events = Events;
class EventListResponsesV4PagePagination extends pagination_1.V4PagePagination {
}
exports.EventListResponsesV4PagePagination = EventListResponsesV4PagePagination;
Events.EventListResponsesV4PagePagination = EventListResponsesV4PagePagination;
//# sourceMappingURL=events.js.map