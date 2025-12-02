// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class Evaluations extends APIResource {
    /**
     * Create a new Evaluation
     *
     * @example
     * ```ts
     * const evaluation =
     *   await client.aiGateway.evaluations.create('my-gateway', {
     *     account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0',
     *     dataset_ids: ['string'],
     *     evaluation_type_ids: ['string'],
     *     name: 'name',
     *   });
     * ```
     */
    create(gatewayId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/evaluations`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List Evaluations
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const evaluationListResponse of client.aiGateway.evaluations.list(
     *   'my-gateway',
     *   { account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(gatewayId, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/evaluations`, EvaluationListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Delete a Evaluation
     *
     * @example
     * ```ts
     * const evaluation =
     *   await client.aiGateway.evaluations.delete(
     *     'my-gateway',
     *     'id',
     *     { account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0' },
     *   );
     * ```
     */
    delete(gatewayId, id, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/evaluations/${id}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch a Evaluation
     *
     * @example
     * ```ts
     * const evaluation = await client.aiGateway.evaluations.get(
     *   'my-gateway',
     *   'id',
     *   { account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0' },
     * );
     * ```
     */
    get(gatewayId, id, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/evaluations/${id}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class EvaluationListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Evaluations.EvaluationListResponsesV4PagePaginationArray = EvaluationListResponsesV4PagePaginationArray;
//# sourceMappingURL=evaluations.mjs.map