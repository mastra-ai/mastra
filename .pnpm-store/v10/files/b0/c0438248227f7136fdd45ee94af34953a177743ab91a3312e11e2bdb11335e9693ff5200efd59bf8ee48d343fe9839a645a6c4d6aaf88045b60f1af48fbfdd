// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as VersionsAPI from "./versions.mjs";
import { VersionListResponsesV4PagePaginationArray, Versions, } from "./versions.mjs";
import * as InstancesAPI from "./instances/instances.mjs";
import { InstanceBulkResponsesSinglePage, InstanceListResponsesV4PagePaginationArray, Instances as InstancesAPIInstances, } from "./instances/instances.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class Workflows extends APIResource {
    constructor() {
        super(...arguments);
        this.instances = new InstancesAPI.Instances(this._client);
        this.versions = new VersionsAPI.Versions(this._client);
    }
    /**
     * Create/modify Workflow
     */
    update(workflowName, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/workflows/${workflowName}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List all Workflows
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workflows`, WorkflowListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletes a Workflow. This only deletes the Workflow and does not delete or modify
     * any Worker associated to this Workflow or bounded to it.
     */
    delete(workflowName, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/workflows/${workflowName}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get Workflow details
     */
    get(workflowName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workflows/${workflowName}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class WorkflowListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Workflows.WorkflowListResponsesV4PagePaginationArray = WorkflowListResponsesV4PagePaginationArray;
Workflows.Instances = InstancesAPIInstances;
Workflows.InstanceListResponsesV4PagePaginationArray = InstanceListResponsesV4PagePaginationArray;
Workflows.InstanceBulkResponsesSinglePage = InstanceBulkResponsesSinglePage;
Workflows.Versions = Versions;
Workflows.VersionListResponsesV4PagePaginationArray = VersionListResponsesV4PagePaginationArray;
//# sourceMappingURL=workflows.mjs.map