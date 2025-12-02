// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class Recipients extends APIResource {
    /**
     * Create a new share recipient
     *
     * @example
     * ```ts
     * const recipient =
     *   await client.resourceSharing.recipients.create(
     *     '3fd85f74b32742f1bff64a85009dda07',
     *     { path_account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    create(shareId, params, options) {
        const { path_account_id, ...body } = params;
        return this._client.post(`/accounts/${path_account_id}/shares/${shareId}/recipients`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List share recipients by share ID.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const recipientListResponse of client.resourceSharing.recipients.list(
     *   '3fd85f74b32742f1bff64a85009dda07',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(shareId, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/shares/${shareId}/recipients`, RecipientListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletion is not immediate, an updated share recipient object with a new status
     * will be returned.
     *
     * @example
     * ```ts
     * const recipient =
     *   await client.resourceSharing.recipients.delete(
     *     '3fd85f74b32742f1bff64a85009dda07',
     *     '3fd85f74b32742f1bff64a85009dda07',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(shareId, recipientId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/shares/${shareId}/recipients/${recipientId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get share recipient by ID.
     *
     * @example
     * ```ts
     * const recipient =
     *   await client.resourceSharing.recipients.get(
     *     '3fd85f74b32742f1bff64a85009dda07',
     *     '3fd85f74b32742f1bff64a85009dda07',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(shareId, recipientId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/shares/${shareId}/recipients/${recipientId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class RecipientListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Recipients.RecipientListResponsesV4PagePaginationArray = RecipientListResponsesV4PagePaginationArray;
//# sourceMappingURL=recipients.mjs.map