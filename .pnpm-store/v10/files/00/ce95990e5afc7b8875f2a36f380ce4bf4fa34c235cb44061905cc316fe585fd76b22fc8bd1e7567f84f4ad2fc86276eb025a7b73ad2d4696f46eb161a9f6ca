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
exports.InstanceBulkResponsesSinglePage = exports.InstanceListResponsesV4PagePaginationArray = exports.Instances = void 0;
const resource_1 = require("../../../resource.js");
const EventsAPI = __importStar(require("./events.js"));
const events_1 = require("./events.js");
const StatusAPI = __importStar(require("./status.js"));
const status_1 = require("./status.js");
const pagination_1 = require("../../../pagination.js");
class Instances extends resource_1.APIResource {
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
exports.Instances = Instances;
class InstanceListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.InstanceListResponsesV4PagePaginationArray = InstanceListResponsesV4PagePaginationArray;
class InstanceBulkResponsesSinglePage extends pagination_1.SinglePage {
}
exports.InstanceBulkResponsesSinglePage = InstanceBulkResponsesSinglePage;
Instances.InstanceListResponsesV4PagePaginationArray = InstanceListResponsesV4PagePaginationArray;
Instances.InstanceBulkResponsesSinglePage = InstanceBulkResponsesSinglePage;
Instances.Status = status_1.Status;
Instances.Events = events_1.Events;
//# sourceMappingURL=instances.js.map