"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowListResponsesV4PagePaginationArray = exports.Workflows = void 0;
const resource_1 = require("../../resource.js");
const VersionsAPI = __importStar(require("./versions.js"));
const versions_1 = require("./versions.js");
const InstancesAPI = __importStar(require("./instances/instances.js"));
const instances_1 = require("./instances/instances.js");
const pagination_1 = require("../../pagination.js");
class Workflows extends resource_1.APIResource {
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
exports.Workflows = Workflows;
class WorkflowListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.WorkflowListResponsesV4PagePaginationArray = WorkflowListResponsesV4PagePaginationArray;
Workflows.WorkflowListResponsesV4PagePaginationArray = WorkflowListResponsesV4PagePaginationArray;
Workflows.Instances = instances_1.Instances;
Workflows.InstanceListResponsesV4PagePaginationArray = instances_1.InstanceListResponsesV4PagePaginationArray;
Workflows.InstanceBulkResponsesSinglePage = instances_1.InstanceBulkResponsesSinglePage;
Workflows.Versions = versions_1.Versions;
Workflows.VersionListResponsesV4PagePaginationArray = versions_1.VersionListResponsesV4PagePaginationArray;
//# sourceMappingURL=workflows.js.map