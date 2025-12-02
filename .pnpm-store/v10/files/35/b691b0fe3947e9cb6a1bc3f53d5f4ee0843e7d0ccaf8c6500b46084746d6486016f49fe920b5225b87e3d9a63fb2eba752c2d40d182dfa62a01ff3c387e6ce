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
exports.GatewayListsSinglePage = exports.Lists = void 0;
const resource_1 = require("../../../../resource.js");
const ItemsAPI = __importStar(require("./items.js"));
const items_1 = require("./items.js");
const pagination_1 = require("../../../../pagination.js");
class Lists extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.items = new ItemsAPI.Items(this._client);
    }
    /**
     * Creates a new Zero Trust list.
     *
     * @example
     * ```ts
     * const list = await client.zeroTrust.gateway.lists.create({
     *   account_id: '699d98642c564d2e855e9661899b7252',
     *   name: 'Admin Serial Numbers',
     *   type: 'SERIAL',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/gateway/lists`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a configured Zero Trust list. Skips updating list items if not included
     * in the payload.
     *
     * @example
     * ```ts
     * const gatewayList =
     *   await client.zeroTrust.gateway.lists.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '699d98642c564d2e855e9661899b7252',
     *       name: 'Admin Serial Numbers',
     *     },
     *   );
     * ```
     */
    update(listId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/gateway/lists/${listId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches all Zero Trust lists for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const gatewayList of client.zeroTrust.gateway.lists.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/gateway/lists`, GatewayListsSinglePage, {
            query,
            ...options,
        });
    }
    /**
     * Deletes a Zero Trust list.
     *
     * @example
     * ```ts
     * const list = await client.zeroTrust.gateway.lists.delete(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * );
     * ```
     */
    delete(listId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/gateway/lists/${listId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Appends or removes an item from a configured Zero Trust list.
     *
     * @example
     * ```ts
     * const gatewayList =
     *   await client.zeroTrust.gateway.lists.edit(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    edit(listId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/gateway/lists/${listId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a single Zero Trust list.
     *
     * @example
     * ```ts
     * const gatewayList =
     *   await client.zeroTrust.gateway.lists.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(listId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/gateway/lists/${listId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Lists = Lists;
class GatewayListsSinglePage extends pagination_1.SinglePage {
}
exports.GatewayListsSinglePage = GatewayListsSinglePage;
Lists.GatewayListsSinglePage = GatewayListsSinglePage;
Lists.Items = items_1.Items;
Lists.ItemListResponsesSinglePage = items_1.ItemListResponsesSinglePage;
//# sourceMappingURL=lists.js.map