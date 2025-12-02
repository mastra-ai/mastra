"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Accounts = void 0;
const resource_1 = require("../../../resource.js");
class Accounts extends resource_1.APIResource {
    /**
     * Add an account as a member of a particular address map.
     *
     * @example
     * ```ts
     * const account =
     *   await client.addressing.addressMaps.accounts.update(
     *     '055817b111884e0227e1be16a0be6ee0',
     *     {
     *       account_id: '258def64c72dae45f3e4c8516e2111f2',
     *       body: {},
     *     },
     *   );
     * ```
     */
    update(addressMapId, params, options) {
        const { account_id, body } = params;
        return this._client.put(`/accounts/${account_id}/addressing/address_maps/${addressMapId}/accounts/${account_id}`, { body: body, ...options });
    }
    /**
     * Remove an account as a member of a particular address map.
     *
     * @example
     * ```ts
     * const account =
     *   await client.addressing.addressMaps.accounts.delete(
     *     '055817b111884e0227e1be16a0be6ee0',
     *     { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     *   );
     * ```
     */
    delete(addressMapId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/addressing/address_maps/${addressMapId}/accounts/${account_id}`, options);
    }
}
exports.Accounts = Accounts;
//# sourceMappingURL=accounts.js.map