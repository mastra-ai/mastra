"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvaluationTypeListResponsesV4PagePaginationArray = exports.EvaluationTypes = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class EvaluationTypes extends resource_1.APIResource {
    /**
     * List Evaluators
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const evaluationTypeListResponse of client.aiGateway.evaluationTypes.list(
     *   { account_id: '0d37909e38d3e99c29fa2cd343ac421a' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/ai-gateway/evaluation-types`, EvaluationTypeListResponsesV4PagePaginationArray, { query, ...options });
    }
}
exports.EvaluationTypes = EvaluationTypes;
class EvaluationTypeListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.EvaluationTypeListResponsesV4PagePaginationArray = EvaluationTypeListResponsesV4PagePaginationArray;
EvaluationTypes.EvaluationTypeListResponsesV4PagePaginationArray =
    EvaluationTypeListResponsesV4PagePaginationArray;
//# sourceMappingURL=evaluation-types.js.map