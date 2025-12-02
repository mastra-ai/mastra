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
exports.AddressMapsSinglePage = exports.AddressMaps = void 0;
const resource_1 = require("../../../resource.js");
const AccountsAPI = __importStar(require("./accounts.js"));
const accounts_1 = require("./accounts.js");
const AddressMapsIPsAPI = __importStar(require("./ips.js"));
const ips_1 = require("./ips.js");
const ZonesAPI = __importStar(require("./zones.js"));
const zones_1 = require("./zones.js");
const pagination_1 = require("../../../pagination.js");
class AddressMaps extends resource_1.APIResource {
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
exports.AddressMaps = AddressMaps;
class AddressMapsSinglePage extends pagination_1.SinglePage {
}
exports.AddressMapsSinglePage = AddressMapsSinglePage;
AddressMaps.AddressMapsSinglePage = AddressMapsSinglePage;
AddressMaps.Accounts = accounts_1.Accounts;
AddressMaps.IPs = ips_1.IPs;
AddressMaps.Zones = zones_1.Zones;
//# sourceMappingURL=address-maps.js.map