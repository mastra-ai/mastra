// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class Logs extends APIResource {
    /**
     * List Gateway Logs
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const logListResponse of client.aiGateway.logs.list(
     *   'my-gateway',
     *   { account_id: '0d37909e38d3e99c29fa2cd343ac421a' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(gatewayId, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/logs`, LogListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Delete Gateway Logs
     *
     * @example
     * ```ts
     * const log = await client.aiGateway.logs.delete(
     *   'my-gateway',
     *   { account_id: '0d37909e38d3e99c29fa2cd343ac421a' },
     * );
     * ```
     */
    delete(gatewayId, params, options) {
        const { account_id, filters, limit, order_by, order_by_direction } = params;
        return this._client.delete(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/logs`, {
            query: { filters, limit, order_by, order_by_direction },
            ...options,
        });
    }
    /**
     * Patch Gateway Log
     *
     * @example
     * ```ts
     * const response = await client.aiGateway.logs.edit(
     *   'my-gateway',
     *   'id',
     *   { account_id: '0d37909e38d3e99c29fa2cd343ac421a' },
     * );
     * ```
     */
    edit(gatewayId, id, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/logs/${id}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get Gateway Log Detail
     *
     * @example
     * ```ts
     * const log = await client.aiGateway.logs.get(
     *   'my-gateway',
     *   'id',
     *   { account_id: '0d37909e38d3e99c29fa2cd343ac421a' },
     * );
     * ```
     */
    get(gatewayId, id, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/logs/${id}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get Gateway Log Request
     *
     * @example
     * ```ts
     * const response = await client.aiGateway.logs.request(
     *   'my-gateway',
     *   'id',
     *   { account_id: '0d37909e38d3e99c29fa2cd343ac421a' },
     * );
     * ```
     */
    request(gatewayId, id, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/logs/${id}/request`, options);
    }
    /**
     * Get Gateway Log Response
     *
     * @example
     * ```ts
     * const response = await client.aiGateway.logs.response(
     *   'my-gateway',
     *   'id',
     *   { account_id: '0d37909e38d3e99c29fa2cd343ac421a' },
     * );
     * ```
     */
    response(gatewayId, id, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/logs/${id}/response`, options);
    }
}
export class LogListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Logs.LogListResponsesV4PagePaginationArray = LogListResponsesV4PagePaginationArray;
//# sourceMappingURL=logs.mjs.map