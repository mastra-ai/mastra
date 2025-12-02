// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as AccountsAPI from "./accounts.mjs";
import { Accounts, } from "./accounts.mjs";
import * as AddressMapsIPsAPI from "./ips.mjs";
import { IPs } from "./ips.mjs";
import * as ZonesAPI from "./zones.mjs";
import { Zones } from "./zones.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class AddressMaps extends APIResource {
    constructor() {
        super(...arguments);
        this.accounts = new AccountsAPI.Accounts(this._client);
        this.ips = new AddressMapsIPsAPI.IPs(this._client);
        this.zones = new ZonesAPI.Zones(this._client);
    }
    /**
     * Create a new address map under the account.
     *
     * @example
     * ```ts
     * const addressMap =
     *   await client.addressing.addressMaps.create({
     *     account_id: '258def64c72dae45f3e4c8516e2111f2',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/addressing/address_maps`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List all address maps owned by the account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const addressMap of client.addressing.addressMaps.list(
     *   { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/addressing/address_maps`, AddressMapsSinglePage, options);
    }
    /**
     * Delete a particular address map owned by the account. An Address Map must be
     * disabled before it can be deleted.
     *
     * @example
     * ```ts
     * const addressMap =
     *   await client.addressing.addressMaps.delete(
     *     '055817b111884e0227e1be16a0be6ee0',
     *     { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     *   );
     * ```
     */
    delete(addressMapId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/addressing/address_maps/${addressMapId}`, options);
    }
    /**
     * Modify properties of an address map owned by the account.
     *
     * @example
     * ```ts
     * const addressMap = await client.addressing.addressMaps.edit(
     *   '055817b111884e0227e1be16a0be6ee0',
     *   { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     * );
     * ```
     */
    edit(addressMapId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/addressing/address_maps/${addressMapId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Show a particular address map owned by the account.
     *
     * @example
     * ```ts
     * const addressMap = await client.addressing.addressMaps.get(
     *   '055817b111884e0227e1be16a0be6ee0',
     *   { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     * );
     * ```
     */
    get(addressMapId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/addressing/address_maps/${addressMapId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class AddressMapsSinglePage extends SinglePage {
}
AddressMaps.AddressMapsSinglePage = AddressMapsSinglePage;
AddressMaps.Accounts = Accounts;
AddressMaps.IPs = IPs;
AddressMaps.Zones = Zones;
//# sourceMappingURL=address-maps.mjs.map