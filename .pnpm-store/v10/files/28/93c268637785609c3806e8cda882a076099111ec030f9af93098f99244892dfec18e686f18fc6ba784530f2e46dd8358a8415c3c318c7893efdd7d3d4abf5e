// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SubscriptionsSinglePage } from "../shared.mjs";
export class Subscriptions extends APIResource {
    /**
     * Updates a user's subscriptions.
     *
     * @example
     * ```ts
     * const subscription = await client.user.subscriptions.update(
     *   '506e3185e9c882d175a2d0cb0093d9f2',
     * );
     * ```
     */
    update(identifier, body, options) {
        return this._client.put(`/user/subscriptions/${identifier}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes a user's subscription.
     *
     * @example
     * ```ts
     * const subscription = await client.user.subscriptions.delete(
     *   '506e3185e9c882d175a2d0cb0093d9f2',
     * );
     * ```
     */
    delete(identifier, options) {
        return this._client.delete(`/user/subscriptions/${identifier}`, options);
    }
    /**
     * Lists all of a user's subscriptions.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const subscription of client.user.subscriptions.get()) {
     *   // ...
     * }
     * ```
     */
    get(options) {
        return this._client.getAPIList('/user/subscriptions', SubscriptionsSinglePage, options);
    }
}
export { SubscriptionsSinglePage };
//# sourceMappingURL=subscriptions.mjs.map