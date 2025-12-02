"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskListResponsesSinglePage = exports.Tasks = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Tasks extends resource_1.APIResource {
    /**
     * Task Search
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/ai/tasks/search`, TaskListResponsesSinglePage, options);
    }
}
exports.Tasks = Tasks;
class TaskListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.TaskListResponsesSinglePage = TaskListResponsesSinglePage;
Tasks.TaskListResponsesSinglePage = TaskListResponsesSinglePage;
//# sourceMappingURL=tasks.js.map