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
exports.AIGatewayListResponsesV4PagePaginationArray = exports.AIGateway = void 0;
const resource_1 = require("../../resource.js");
const DatasetsAPI = __importStar(require("./datasets.js"));
const datasets_1 = require("./datasets.js");
const EvaluationTypesAPI = __importStar(require("./evaluation-types.js"));
const evaluation_types_1 = require("./evaluation-types.js");
const EvaluationsAPI = __importStar(require("./evaluations.js"));
const evaluations_1 = require("./evaluations.js");
const LogsAPI = __importStar(require("./logs.js"));
const logs_1 = require("./logs.js");
const URLsAPI = __importStar(require("./urls.js"));
const urls_1 = require("./urls.js");
const pagination_1 = require("../../pagination.js");
class AIGateway extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.evaluationTypes = new EvaluationTypesAPI.EvaluationTypes(this._client);
        this.logs = new LogsAPI.Logs(this._client);
        this.datasets = new DatasetsAPI.Datasets(this._client);
        this.evaluations = new EvaluationsAPI.Evaluations(this._client);
        this.urls = new URLsAPI.URLs(this._client);
    }
    /**
     * Create a new Gateway
     *
     * @example
     * ```ts
     * const aiGateway = await client.aiGateway.create({
     *   account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0',
     *   id: 'my-gateway',
     *   cache_invalidate_on_update: true,
     *   cache_ttl: 0,
     *   collect_logs: true,
     *   rate_limiting_interval: 0,
     *   rate_limiting_limit: 0,
     *   rate_limiting_technique: 'fixed',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/ai-gateway/gateways`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a Gateway
     *
     * @example
     * ```ts
     * const aiGateway = await client.aiGateway.update(
     *   'my-gateway',
     *   {
     *     account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0',
     *     cache_invalidate_on_update: true,
     *     cache_ttl: 0,
     *     collect_logs: true,
     *     rate_limiting_interval: 0,
     *     rate_limiting_limit: 0,
     *     rate_limiting_technique: 'fixed',
     *   },
     * );
     * ```
     */
    update(id, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/ai-gateway/gateways/${id}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List Gateways
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const aiGatewayListResponse of client.aiGateway.list(
     *   { account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/ai-gateway/gateways`, AIGatewayListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Delete a Gateway
     *
     * @example
     * ```ts
     * const aiGateway = await client.aiGateway.delete(
     *   'my-gateway',
     *   { account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0' },
     * );
     * ```
     */
    delete(id, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/ai-gateway/gateways/${id}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch a Gateway
     *
     * @example
     * ```ts
     * const aiGateway = await client.aiGateway.get('my-gateway', {
     *   account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0',
     * });
     * ```
     */
    get(id, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/ai-gateway/gateways/${id}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.AIGateway = AIGateway;
class AIGatewayListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.AIGatewayListResponsesV4PagePaginationArray = AIGatewayListResponsesV4PagePaginationArray;
AIGateway.AIGatewayListResponsesV4PagePaginationArray = AIGatewayListResponsesV4PagePaginationArray;
AIGateway.EvaluationTypes = evaluation_types_1.EvaluationTypes;
AIGateway.EvaluationTypeListResponsesV4PagePaginationArray = evaluation_types_1.EvaluationTypeListResponsesV4PagePaginationArray;
AIGateway.Logs = logs_1.Logs;
AIGateway.LogListResponsesV4PagePaginationArray = logs_1.LogListResponsesV4PagePaginationArray;
AIGateway.Datasets = datasets_1.Datasets;
AIGateway.DatasetListResponsesV4PagePaginationArray = datasets_1.DatasetListResponsesV4PagePaginationArray;
AIGateway.Evaluations = evaluations_1.Evaluations;
AIGateway.EvaluationListResponsesV4PagePaginationArray = evaluations_1.EvaluationListResponsesV4PagePaginationArray;
AIGateway.URLs = urls_1.URLs;
//# sourceMappingURL=ai-gateway.js.map