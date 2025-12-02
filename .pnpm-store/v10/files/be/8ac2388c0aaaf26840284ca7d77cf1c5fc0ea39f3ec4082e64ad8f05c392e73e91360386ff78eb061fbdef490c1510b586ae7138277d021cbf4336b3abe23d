"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPs = void 0;
const resource_1 = require("../../../resource.js");
class IPs extends resource_1.APIResource {
    /**
     * Add an IP from a prefix owned by the account to a particular address map.
     *
     * @example
     * ```ts
     * const ip = await client.addressing.addressMaps.ips.update(
     *   '055817b111884e0227e1be16a0be6ee0',
     *   '192.0.2.1',
     *   {
     *     account_id: '258def64c72dae45f3e4c8516e2111f2',
     *     body: {},
     *   },
     * );
     * ```
     */
    update(addressMapId, ipAddress, params, options) {
        const { account_id, body } = params;
        return this._client.put(`/accounts/${account_id}/addressing/address_maps/${addressMapId}/ips/${ipAddress}`, { body: body, ...options });
    }
    /**
     * Remove an IP from a particular address map.
     *
     * @example
     * ```ts
     * const ip = await client.addressing.addressMaps.ips.delete(
     *   '055817b111884e0227e1be16a0be6ee0',
     *   '192.0.2.1',
     *   { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     * );
     * ```
     */
    delete(addressMapId, ipAddress, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/addressing/address_maps/${addressMapId}/ips/${ipAddress}`, options);
    }
}
exports.IPs = IPs;
//# sourceMappingURL=ips.js.map