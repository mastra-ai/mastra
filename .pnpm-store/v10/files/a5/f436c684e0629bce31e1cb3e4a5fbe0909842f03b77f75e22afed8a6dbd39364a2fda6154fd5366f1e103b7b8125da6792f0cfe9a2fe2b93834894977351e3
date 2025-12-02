"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceSharingListResponsesV4PagePaginationArray = exports.ResourceSharing = void 0;
const resource_1 = require("../../resource.js");
const RecipientsAPI = __importStar(require("./recipients.js"));
const recipients_1 = require("./recipients.js");
const ResourcesAPI = __importStar(require("./resources.js"));
const resources_1 = require("./resources.js");
const pagination_1 = require("../../pagination.js");
class ResourceSharing extends resource_1.APIResource {
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
exports.ResourceSharing = ResourceSharing;
class ResourceSharingListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.ResourceSharingListResponsesV4PagePaginationArray = ResourceSharingListResponsesV4PagePaginationArray;
ResourceSharing.ResourceSharingListResponsesV4PagePaginationArray =
    ResourceSharingListResponsesV4PagePaginationArray;
ResourceSharing.Recipients = recipients_1.Recipients;
ResourceSharing.RecipientListResponsesV4PagePaginationArray = recipients_1.RecipientListResponsesV4PagePaginationArray;
ResourceSharing.Resources = resources_1.Resources;
ResourceSharing.ResourceListResponsesV4PagePaginationArray = resources_1.ResourceListResponsesV4PagePaginationArray;
//# sourceMappingURL=resource-sharing.js.map