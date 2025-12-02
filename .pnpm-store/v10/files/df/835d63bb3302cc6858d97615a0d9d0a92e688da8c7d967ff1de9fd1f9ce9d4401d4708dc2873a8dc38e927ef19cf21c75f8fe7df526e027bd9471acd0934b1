// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as EventsAPI from "./events.mjs";
import { Events } from "./events.mjs";
import * as StatusAPI from "./status.mjs";
import { Status } from "./status.mjs";
import { SinglePage, V4PagePaginationArray } from "../../../pagination.mjs";
export class Instances extends APIResource {
    constructor() {
        super(...arguments);
        this.status = new StatusAPI.Status(this._client);
        this.events = new EventsAPI.Events(this._client);
    }
    /**
     * Create a new workflow instance
     */
    create(workflowName, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/workflows/${workflowName}/instances`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List of workflow instances
     */
    list(workflowName, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workflows/${workflowName}/instances`, InstanceListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Batch create new Workflow instances
     */
    bulk(workflowName, params, options) {
        const { account_id, body } = params ?? {};
        return this._client.getAPIList(`/accounts/${account_id}/workflows/${workflowName}/instances/batch`, InstanceBulkResponsesSinglePage, { body: body, method: 'post', ...options });
    }
    /**
     * Get logs and status from instance
     */
    get(workflowName, instanceId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workflows/${workflowName}/instances/${instanceId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class InstanceListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
export class InstanceBulkResponsesSinglePage extends SinglePage {
}
Instances.InstanceListResponsesV4PagePaginationArray = InstanceListResponsesV4PagePaginationArray;
Instances.InstanceBulkResponsesSinglePage = InstanceBulkResponsesSinglePage;
Instances.Status = Status;
Instances.Events = Events;
//# sourceMappingURL=instances.mjs.map