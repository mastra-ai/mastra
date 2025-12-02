// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Categories extends APIResource {
    /**
     * Creates a new category
     *
     * @example
     * ```ts
     * const category =
     *   await client.cloudforceOne.threatEvents.categories.create(
     *     {
     *       account_id: 'account_id',
     *       killChain: 0,
     *       name: 'name',
     *     },
     *   );
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/cloudforce-one/events/categories/create`, {
            body,
            ...options,
        });
    }
    /**
     * Lists categories
     *
     * @example
     * ```ts
     * const categories =
     *   await client.cloudforceOne.threatEvents.categories.list({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/events/categories`, options);
    }
    /**
     * Deletes a category
     *
     * @example
     * ```ts
     * const category =
     *   await client.cloudforceOne.threatEvents.categories.delete(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(categoryId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/cloudforce-one/events/categories/${categoryId}`, options);
    }
    /**
     * Updates a category
     *
     * @example
     * ```ts
     * const response =
     *   await client.cloudforceOne.threatEvents.categories.edit(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    edit(categoryId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/cloudforce-one/events/categories/${categoryId}`, {
            body,
            ...options,
        });
    }
    /**
     * Reads a category
     *
     * @example
     * ```ts
     * const category =
     *   await client.cloudforceOne.threatEvents.categories.get(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(categoryId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/events/categories/${categoryId}`, options);
    }
}
//# sourceMappingURL=categories.mjs.map