// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class Addresses extends APIResource {
    /**
     * Create a destination address to forward your emails to. Destination addresses
     * need to be verified before they can be used.
     *
     * @example
     * ```ts
     * const address = await client.emailRouting.addresses.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   email: 'user@example.com',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/email/routing/addresses`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists existing destination addresses.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const address of client.emailRouting.addresses.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/email/routing/addresses`, AddressesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletes a specific destination address.
     *
     * @example
     * ```ts
     * const address = await client.emailRouting.addresses.delete(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(destinationAddressIdentifier, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/email/routing/addresses/${destinationAddressIdentifier}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Gets information for a specific destination email already created.
     *
     * @example
     * ```ts
     * const address = await client.emailRouting.addresses.get(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(destinationAddressIdentifier, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/email/routing/addresses/${destinationAddressIdentifier}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class AddressesV4PagePaginationArray extends V4PagePaginationArray {
}
Addresses.AddressesV4PagePaginationArray = AddressesV4PagePaginationArray;
//# sourceMappingURL=addresses.mjs.map