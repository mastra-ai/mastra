"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Status = void 0;
const resource_1 = require("../../../resource.js");
class Status extends resource_1.APIResource {
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
exports.Status = Status;
//# sourceMappingURL=status.js.map