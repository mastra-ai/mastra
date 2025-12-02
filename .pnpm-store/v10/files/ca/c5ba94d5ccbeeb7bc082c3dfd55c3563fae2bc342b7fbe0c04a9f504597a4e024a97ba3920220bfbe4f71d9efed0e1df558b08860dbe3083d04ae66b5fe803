"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Events = void 0;
const resource_1 = require("../../../resource.js");
class Events extends resource_1.APIResource {
    /**
     * Send event to instance
     */
    create(workflowName, instanceId, eventType, params, options) {
        const { account_id, body } = params ?? {};
        return this._client.post(`/accounts/${account_id}/workflows/${workflowName}/instances/${instanceId}/events/${eventType}`, { body: body, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Events = Events;
//# sourceMappingURL=events.js.map