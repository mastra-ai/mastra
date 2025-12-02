"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceListResponsesV4PagePaginationArray = exports.Resources = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Resources extends resource_1.APIResource {
    /**
     * Create a new share resource
     *
     * @example
     * ```ts
     * const resource =
     *   await client.resourceSharing.resources.create(
     *     '3fd85f74b32742f1bff64a85009dda07',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       meta: {},
     *       resource_account_id:
     *         '023e105f4ecef8ad9ca31a8372d0c353',
     *       resource_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       resource_type: 'custom-ruleset',
     *     },
     *   );
     * ```
     */
    create(shareId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/shares/${shareId}/resources`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update is not immediate, an updated share resource object with a new status will
     * be returned.
     *
     * @example
     * ```ts
     * const resource =
     *   await client.resourceSharing.resources.update(
     *     '3fd85f74b32742f1bff64a85009dda07',
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       meta: {},
     *     },
     *   );
     * ```
     */
    update(shareId, resourceId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/shares/${shareId}/resources/${resourceId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List share resources by share ID.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const resourceListResponse of client.resourceSharing.resources.list(
     *   '3fd85f74b32742f1bff64a85009dda07',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(shareId, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/shares/${shareId}/resources`, ResourceListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletion is not immediate, an updated share resource object with a new status
     * will be returned.
     *
     * @example
     * ```ts
     * const resource =
     *   await client.resourceSharing.resources.delete(
     *     '3fd85f74b32742f1bff64a85009dda07',
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(shareId, resourceId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/shares/${shareId}/resources/${resourceId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get share resource by ID.
     *
     * @example
     * ```ts
     * const resource = await client.resourceSharing.resources.get(
     *   '3fd85f74b32742f1bff64a85009dda07',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(shareId, resourceId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/shares/${shareId}/resources/${resourceId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Resources = Resources;
class ResourceListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.ResourceListResponsesV4PagePaginationArray = ResourceListResponsesV4PagePaginationArray;
Resources.ResourceListResponsesV4PagePaginationArray = ResourceListResponsesV4PagePaginationArray;
//# sourceMappingURL=resources.js.map