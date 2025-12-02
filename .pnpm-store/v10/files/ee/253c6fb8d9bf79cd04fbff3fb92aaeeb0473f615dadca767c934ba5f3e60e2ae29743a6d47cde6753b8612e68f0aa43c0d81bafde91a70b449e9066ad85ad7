// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as RecipientsAPI from "./recipients.mjs";
import { RecipientListResponsesV4PagePaginationArray, Recipients, } from "./recipients.mjs";
import * as ResourcesAPI from "./resources.mjs";
import { ResourceListResponsesV4PagePaginationArray, Resources, } from "./resources.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class ResourceSharing extends APIResource {
    constructor() {
        super(...arguments);
        this.recipients = new RecipientsAPI.Recipients(this._client);
        this.resources = new ResourcesAPI.Resources(this._client);
    }
    /**
     * Create a new share
     *
     * @example
     * ```ts
     * const resourceSharing = await client.resourceSharing.create(
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     name: 'My Shared WAF Managed Rule',
     *     recipients: [{}],
     *     resources: [
     *       {
     *         meta: {},
     *         resource_account_id:
     *           '023e105f4ecef8ad9ca31a8372d0c353',
     *         resource_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *         resource_type: 'custom-ruleset',
     *       },
     *     ],
     *   },
     * );
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/shares`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updating is not immediate, an updated share object with a new status will be
     * returned.
     *
     * @example
     * ```ts
     * const resourceSharing = await client.resourceSharing.update(
     *   '3fd85f74b32742f1bff64a85009dda07',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     name: 'My Shared WAF Managed Rule',
     *   },
     * );
     * ```
     */
    update(shareId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/shares/${shareId}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists all account shares.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const resourceSharingListResponse of client.resourceSharing.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/shares`, ResourceSharingListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletion is not immediate, an updated share object with a new status will be
     * returned.
     *
     * @example
     * ```ts
     * const resourceSharing = await client.resourceSharing.delete(
     *   '3fd85f74b32742f1bff64a85009dda07',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(shareId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/shares/${shareId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches share by ID.
     *
     * @example
     * ```ts
     * const resourceSharing = await client.resourceSharing.get(
     *   '3fd85f74b32742f1bff64a85009dda07',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(shareId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/shares/${shareId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class ResourceSharingListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
ResourceSharing.ResourceSharingListResponsesV4PagePaginationArray =
    ResourceSharingListResponsesV4PagePaginationArray;
ResourceSharing.Recipients = Recipients;
ResourceSharing.RecipientListResponsesV4PagePaginationArray = RecipientListResponsesV4PagePaginationArray;
ResourceSharing.Resources = Resources;
ResourceSharing.ResourceListResponsesV4PagePaginationArray = ResourceListResponsesV4PagePaginationArray;
//# sourceMappingURL=resource-sharing.mjs.map