"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Zones = void 0;
const resource_1 = require("../../../resource.js");
class Zones extends resource_1.APIResource {
    /**
     * Add a zone as a member of a particular address map.
     *
     * @example
     * ```ts
     * const zone =
     *   await client.addressing.addressMaps.zones.update(
     *     '055817b111884e0227e1be16a0be6ee0',
     *     {
     *       zone_id: '8ac8489932db6327334c9b6d58544cfe',
     *       account_id: '258def64c72dae45f3e4c8516e2111f2',
     *       body: {},
     *     },
     *   );
     * ```
     */
    update(addressMapId, params, options) {
        const { zone_id, account_id, body } = params;
        return this._client.put(`/accounts/${account_id}/addressing/address_maps/${addressMapId}/zones/${zone_id}`, { body: body, ...options });
    }
    /**
     * Remove a zone as a member of a particular address map.
     *
     * @example
     * ```ts
     * const zone =
     *   await client.addressing.addressMaps.zones.delete(
     *     '055817b111884e0227e1be16a0be6ee0',
     *     {
     *       zone_id: '8ac8489932db6327334c9b6d58544cfe',
     *       account_id: '258def64c72dae45f3e4c8516e2111f2',
     *     },
     *   );
     * ```
     */
    delete(addressMapId, params, options) {
        const { zone_id, account_id } = params;
        return this._client.delete(`/accounts/${account_id}/addressing/address_maps/${addressMapId}/zones/${zone_id}`, options);
    }
}
exports.Zones = Zones;
//# sourceMappingURL=zones.js.map