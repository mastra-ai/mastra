// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as AccessRequestsAPI from "./access-requests.mjs";
import { AccessRequests } from "./access-requests.mjs";
import * as SCIMAPI from "./scim/scim.mjs";
import { SCIM } from "./scim/scim.mjs";
export class Logs extends APIResource {
    constructor() {
        super(...arguments);
        this.accessRequests = new AccessRequestsAPI.AccessRequests(this._client);
        this.scim = new SCIMAPI.SCIM(this._client);
    }
}
Logs.AccessRequests = AccessRequests;
Logs.SCIM = SCIM;
//# sourceMappingURL=logs.mjs.map