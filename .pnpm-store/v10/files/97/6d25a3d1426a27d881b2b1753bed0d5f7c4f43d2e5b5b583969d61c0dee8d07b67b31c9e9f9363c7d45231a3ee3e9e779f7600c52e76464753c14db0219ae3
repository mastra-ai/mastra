// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Tasks extends APIResource {
    /**
     * Task Search
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/ai/tasks/search`, TaskListResponsesSinglePage, options);
    }
}
export class TaskListResponsesSinglePage extends SinglePage {
}
Tasks.TaskListResponsesSinglePage = TaskListResponsesSinglePage;
//# sourceMappingURL=tasks.mjs.map