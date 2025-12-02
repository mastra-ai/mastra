// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
import { V4PagePagination } from "../../../../pagination.mjs";
export class Events extends APIResource {
    list(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/radar/bgp/leaks/events', EventListResponsesV4PagePagination, {
            query,
            ...options,
        });
    }
}
export class EventListResponsesV4PagePagination extends V4PagePagination {
}
Events.EventListResponsesV4PagePagination = EventListResponsesV4PagePagination;
//# sourceMappingURL=events.mjs.map