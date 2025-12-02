// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Status extends APIResource {
    /**
     * Change status of instance
     */
    edit(workflowName, instanceId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/workflows/${workflowName}/instances/${instanceId}/status`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=status.mjs.map