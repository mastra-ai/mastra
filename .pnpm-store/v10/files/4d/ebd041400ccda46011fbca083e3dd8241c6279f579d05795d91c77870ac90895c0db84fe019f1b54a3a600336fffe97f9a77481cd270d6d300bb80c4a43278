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
exports.RequestTypesResponsesSinglePage = exports.ListItemsSinglePage = exports.Requests = void 0;
const resource_1 = require("../../../resource.js");
const AssetsAPI = __importStar(require("./assets.js"));
const assets_1 = require("./assets.js");
const MessageAPI = __importStar(require("./message.js"));
const message_1 = require("./message.js");
const PriorityAPI = __importStar(require("./priority.js"));
const priority_1 = require("./priority.js");
const pagination_1 = require("../../../pagination.js");
class Requests extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.message = new MessageAPI.MessageResource(this._client);
        this.priority = new PriorityAPI.PriorityResource(this._client);
        this.assets = new AssetsAPI.Assets(this._client);
    }
    /**
     * Creating a request adds the request into the Cloudforce One queue for analysis.
     * In addition to the content, a short title, type, priority, and releasability
     * should be provided. If one is not provided, a default will be assigned.
     *
     * @example
     * ```ts
     * const item = await client.cloudforceOne.requests.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/cloudforce-one/requests/new`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updating a request alters the request in the Cloudforce One queue. This API may
     * be used to update any attributes of the request after the initial submission.
     * Only fields that you choose to update need to be add to the request body.
     *
     * @example
     * ```ts
     * const item = await client.cloudforceOne.requests.update(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(requestId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/cloudforce-one/requests/${requestId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List Requests
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const listItem of client.cloudforceOne.requests.list(
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     page: 0,
     *     per_page: 10,
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/cloudforce-one/requests`, ListItemsSinglePage, {
            body,
            method: 'post',
            ...options,
        });
    }
    /**
     * Delete a Request
     *
     * @example
     * ```ts
     * const request = await client.cloudforceOne.requests.delete(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(requestId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/cloudforce-one/requests/${requestId}`, options);
    }
    /**
     * Get Request Priority, Status, and TLP constants
     *
     * @example
     * ```ts
     * const requestConstants =
     *   await client.cloudforceOne.requests.constants({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    constants(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/requests/constants`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a Request
     *
     * @example
     * ```ts
     * const item = await client.cloudforceOne.requests.get(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(requestId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/requests/${requestId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get Request Quota
     *
     * @example
     * ```ts
     * const quota = await client.cloudforceOne.requests.quota({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    quota(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/requests/quota`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get Request Types
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const requestTypesResponse of client.cloudforceOne.requests.types(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    types(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/cloudforce-one/requests/types`, RequestTypesResponsesSinglePage, options);
    }
}
exports.Requests = Requests;
class ListItemsSinglePage extends pagination_1.SinglePage {
}
exports.ListItemsSinglePage = ListItemsSinglePage;
class RequestTypesResponsesSinglePage extends pagination_1.SinglePage {
}
exports.RequestTypesResponsesSinglePage = RequestTypesResponsesSinglePage;
Requests.ListItemsSinglePage = ListItemsSinglePage;
Requests.RequestTypesResponsesSinglePage = RequestTypesResponsesSinglePage;
Requests.MessageResource = message_1.MessageResource;
Requests.MessagesSinglePage = message_1.MessagesSinglePage;
Requests.PriorityResource = priority_1.PriorityResource;
Requests.Assets = assets_1.Assets;
Requests.AssetCreateResponsesSinglePage = assets_1.AssetCreateResponsesSinglePage;
Requests.AssetGetResponsesSinglePage = assets_1.AssetGetResponsesSinglePage;
//# sourceMappingURL=requests.js.map