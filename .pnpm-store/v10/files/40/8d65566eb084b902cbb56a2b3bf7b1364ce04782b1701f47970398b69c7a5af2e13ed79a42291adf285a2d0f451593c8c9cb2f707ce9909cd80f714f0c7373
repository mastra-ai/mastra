// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class EvaluationTypes extends APIResource {
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
export class EvaluationTypeListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
EvaluationTypes.EvaluationTypeListResponsesV4PagePaginationArray =
    EvaluationTypeListResponsesV4PagePaginationArray;
//# sourceMappingURL=evaluation-types.mjs.map