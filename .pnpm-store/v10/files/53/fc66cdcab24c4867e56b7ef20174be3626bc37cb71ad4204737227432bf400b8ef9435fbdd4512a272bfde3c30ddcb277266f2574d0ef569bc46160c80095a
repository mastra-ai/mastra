"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TargetBulkUpdateResponsesSinglePage = exports.TargetListResponsesV4PagePaginationArray = exports.Targets = void 0;
const resource_1 = require("../../../../resource.js");
const pagination_1 = require("../../../../pagination.js");
class Targets extends resource_1.APIResource {
    /**
     * Create new target
     *
     * @example
     * ```ts
     * const target =
     *   await client.zeroTrust.access.infrastructure.targets.create(
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       hostname: 'infra-access-target',
     *       ip: {},
     *     },
     *   );
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/infrastructure/targets`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update target
     *
     * @example
     * ```ts
     * const target =
     *   await client.zeroTrust.access.infrastructure.targets.update(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       hostname: 'infra-access-target',
     *       ip: {},
     *     },
     *   );
     * ```
     */
    update(targetId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/infrastructure/targets/${targetId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists and sorts an account’s targets. Filters are optional and are ANDed
     * together.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const targetListResponse of client.zeroTrust.access.infrastructure.targets.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/infrastructure/targets`, TargetListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Delete target
     *
     * @example
     * ```ts
     * await client.zeroTrust.access.infrastructure.targets.delete(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(targetId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/infrastructure/targets/${targetId}`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    /**
     * Removes one or more targets.
     *
     * @deprecated
     */
    bulkDelete(params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/infrastructure/targets/batch`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    /**
     * Removes one or more targets.
     *
     * @example
     * ```ts
     * await client.zeroTrust.access.infrastructure.targets.bulkDeleteV2(
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     target_ids: ['182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e'],
     *   },
     * );
     * ```
     */
    bulkDeleteV2(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/infrastructure/targets/batch_delete`, {
            body,
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    /**
     * Adds one or more targets.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const targetBulkUpdateResponse of client.zeroTrust.access.infrastructure.targets.bulkUpdate(
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: [{ hostname: 'infra-access-target', ip: {} }],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    bulkUpdate(params, options) {
        const { account_id, body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/infrastructure/targets/batch`, TargetBulkUpdateResponsesSinglePage, { body: body, method: 'put', ...options });
    }
    /**
     * Get target
     *
     * @example
     * ```ts
     * const target =
     *   await client.zeroTrust.access.infrastructure.targets.get(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(targetId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/infrastructure/targets/${targetId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Targets = Targets;
class TargetListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.TargetListResponsesV4PagePaginationArray = TargetListResponsesV4PagePaginationArray;
class TargetBulkUpdateResponsesSinglePage extends pagination_1.SinglePage {
}
exports.TargetBulkUpdateResponsesSinglePage = TargetBulkUpdateResponsesSinglePage;
Targets.TargetListResponsesV4PagePaginationArray = TargetListResponsesV4PagePaginationArray;
Targets.TargetBulkUpdateResponsesSinglePage = TargetBulkUpdateResponsesSinglePage;
//# sourceMappingURL=targets.js.map