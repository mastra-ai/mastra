// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class Datasets extends APIResource {
    /**
     * Create a new Dataset
     *
     * @example
     * ```ts
     * const dataset = await client.aiGateway.datasets.create(
     *   'my-gateway',
     *   {
     *     account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0',
     *     enable: true,
     *     filters: [
     *       {
     *         key: 'created_at',
     *         operator: 'eq',
     *         value: ['string'],
     *       },
     *     ],
     *     name: 'name',
     *   },
     * );
     * ```
     */
    create(gatewayId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/datasets`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a Dataset
     *
     * @example
     * ```ts
     * const dataset = await client.aiGateway.datasets.update(
     *   'my-gateway',
     *   'id',
     *   {
     *     account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0',
     *     enable: true,
     *     filters: [
     *       {
     *         key: 'created_at',
     *         operator: 'eq',
     *         value: ['string'],
     *       },
     *     ],
     *     name: 'name',
     *   },
     * );
     * ```
     */
    update(gatewayId, id, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/datasets/${id}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List Datasets
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const datasetListResponse of client.aiGateway.datasets.list(
     *   'my-gateway',
     *   { account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(gatewayId, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/datasets`, DatasetListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Delete a Dataset
     *
     * @example
     * ```ts
     * const dataset = await client.aiGateway.datasets.delete(
     *   'my-gateway',
     *   'id',
     *   { account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0' },
     * );
     * ```
     */
    delete(gatewayId, id, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/datasets/${id}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch a Dataset
     *
     * @example
     * ```ts
     * const dataset = await client.aiGateway.datasets.get(
     *   'my-gateway',
     *   'id',
     *   { account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0' },
     * );
     * ```
     */
    get(gatewayId, id, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/datasets/${id}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class DatasetListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Datasets.DatasetListResponsesV4PagePaginationArray = DatasetListResponsesV4PagePaginationArray;
//# sourceMappingURL=datasets.mjs.map