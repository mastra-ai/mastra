// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Subscriptions extends APIResource {
    /**
     * Create a zone subscription, either plan or add-ons.
     *
     * @example
     * ```ts
     * const subscription =
     *   await client.zones.subscriptions.create({
     *     zone_id: '506e3185e9c882d175a2d0cb0093d9f2',
     *   });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/subscription`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates zone subscriptions, either plan or add-ons.
     *
     * @example
     * ```ts
     * const subscription =
     *   await client.zones.subscriptions.update({
     *     zone_id: '506e3185e9c882d175a2d0cb0093d9f2',
     *   });
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/subscription`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists zone subscription details.
     *
     * @example
     * ```ts
     * const subscription = await client.zones.subscriptions.get({
     *   zone_id: '506e3185e9c882d175a2d0cb0093d9f2',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/subscription`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=subscriptions.mjs.map