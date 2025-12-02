// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Events extends APIResource {
    /**
     * Send event to instance
     */
    create(workflowName, instanceId, eventType, params, options) {
        const { account_id, body } = params ?? {};
        return this._client.post(`/accounts/${account_id}/workflows/${workflowName}/instances/${instanceId}/events/${eventType}`, { body: body, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=events.mjs.map