// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as ItemsAPI from "./items.mjs";
import { ItemListResponsesSinglePage, Items } from "./items.mjs";
import { SinglePage } from "../../../../pagination.mjs";
export class Lists extends APIResource {
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
export class GatewayListsSinglePage extends SinglePage {
}
Lists.GatewayListsSinglePage = GatewayListsSinglePage;
Lists.Items = Items;
Lists.ItemListResponsesSinglePage = ItemListResponsesSinglePage;
//# sourceMappingURL=lists.mjs.map