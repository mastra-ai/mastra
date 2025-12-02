// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Slots extends APIResource {
    /**
     * Retrieve a list of all slots matching the specified parameters
     *
     * @example
     * ```ts
     * const slots = await client.networkInterconnects.slots.list({
     *   account_id: 'account_id',
     * });
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/cni/slots`, { query, ...options });
    }
    /**
     * Get information about the specified slot
     *
     * @example
     * ```ts
     * const slot = await client.networkInterconnects.slots.get(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(slot, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cni/slots/${slot}`, options);
    }
}
//# sourceMappingURL=slots.mjs.map