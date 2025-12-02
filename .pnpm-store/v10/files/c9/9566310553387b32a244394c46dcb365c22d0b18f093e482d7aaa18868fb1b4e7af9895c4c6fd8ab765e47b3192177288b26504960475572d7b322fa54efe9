// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SubscriptionsSinglePage } from "../shared.mjs";
export class Subscriptions extends APIResource {
    /**
     * Creates an account subscription.
     *
     * @example
     * ```ts
     * const subscription =
     *   await client.accounts.subscriptions.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/subscriptions`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an account subscription.
     *
     * @example
     * ```ts
     * const subscription =
     *   await client.accounts.subscriptions.update(
     *     '506e3185e9c882d175a2d0cb0093d9f2',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    update(subscriptionIdentifier, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/subscriptions/${subscriptionIdentifier}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes an account's subscription.
     *
     * @example
     * ```ts
     * const subscription =
     *   await client.accounts.subscriptions.delete(
     *     '506e3185e9c882d175a2d0cb0093d9f2',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(subscriptionIdentifier, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/subscriptions/${subscriptionIdentifier}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists all of an account's subscriptions.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const subscription of client.accounts.subscriptions.get(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/subscriptions`, SubscriptionsSinglePage, options);
    }
}
export { SubscriptionsSinglePage };
//# sourceMappingURL=subscriptions.mjs.map