// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as DatasetsAPI from "./datasets.mjs";
import { DatasetListResponsesV4PagePaginationArray, Datasets, } from "./datasets.mjs";
import * as EvaluationTypesAPI from "./evaluation-types.mjs";
import { EvaluationTypeListResponsesV4PagePaginationArray, EvaluationTypes, } from "./evaluation-types.mjs";
import * as EvaluationsAPI from "./evaluations.mjs";
import { EvaluationListResponsesV4PagePaginationArray, Evaluations, } from "./evaluations.mjs";
import * as LogsAPI from "./logs.mjs";
import { LogListResponsesV4PagePaginationArray, Logs, } from "./logs.mjs";
import * as URLsAPI from "./urls.mjs";
import { URLs } from "./urls.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class AIGateway extends APIResource {
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
export class AIGatewayListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
AIGateway.AIGatewayListResponsesV4PagePaginationArray = AIGatewayListResponsesV4PagePaginationArray;
AIGateway.EvaluationTypes = EvaluationTypes;
AIGateway.EvaluationTypeListResponsesV4PagePaginationArray = EvaluationTypeListResponsesV4PagePaginationArray;
AIGateway.Logs = Logs;
AIGateway.LogListResponsesV4PagePaginationArray = LogListResponsesV4PagePaginationArray;
AIGateway.Datasets = Datasets;
AIGateway.DatasetListResponsesV4PagePaginationArray = DatasetListResponsesV4PagePaginationArray;
AIGateway.Evaluations = Evaluations;
AIGateway.EvaluationListResponsesV4PagePaginationArray = EvaluationListResponsesV4PagePaginationArray;
AIGateway.URLs = URLs;
//# sourceMappingURL=ai-gateway.mjs.map