// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { V4PagePaginationArray } from "../../../pagination.mjs";
export class Operations extends APIResource {
    /**
     * Update per-operation schema validation setting
     *
     * @example
     * ```ts
     * const operation =
     *   await client.schemaValidation.settings.operations.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       mitigation_action: 'block',
     *     },
     *   );
     * ```
     */
    update(operationId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/schema_validation/settings/operations/${operationId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List per-operation schema validation settings
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const operationListResponse of client.schemaValidation.settings.operations.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/schema_validation/settings/operations`, OperationListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Delete per-operation schema validation setting
     *
     * @example
     * ```ts
     * const operation =
     *   await client.schemaValidation.settings.operations.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(operationId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/schema_validation/settings/operations/${operationId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Bulk edit per-operation schema validation settings
     *
     * @example
     * ```ts
     * const response =
     *   await client.schemaValidation.settings.operations.bulkEdit(
     *     {
     *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       body: {
     *         '3818d821-5901-4147-a474-f5f5aec1d54e': {},
     *         'b17c8043-99a0-4202-b7d9-8f7cdbee02cd': {},
     *       },
     *     },
     *   );
     * ```
     */
    bulkEdit(params, options) {
        const { zone_id, body } = params;
        return this._client.patch(`/zones/${zone_id}/schema_validation/settings/operations`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get per-operation schema validation setting
     *
     * @example
     * ```ts
     * const operation =
     *   await client.schemaValidation.settings.operations.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(operationId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/schema_validation/settings/operations/${operationId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class OperationListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Operations.OperationListResponsesV4PagePaginationArray = OperationListResponsesV4PagePaginationArray;
//# sourceMappingURL=operations.mjs.map