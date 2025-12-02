"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivationCheck = void 0;
const resource_1 = require("../../resource.js");
class ActivationCheck extends resource_1.APIResource {
    /**
     * Triggeres a new activation check for a PENDING Zone. This can be triggered every
     * 5 min for paygo/ent customers, every hour for FREE Zones.
     *
     * @example
     * ```ts
     * const response = await client.zones.activationCheck.trigger(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    trigger(params, options) {
        const { zone_id } = params;
        return this._client.put(`/zones/${zone_id}/activation_check`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.ActivationCheck = ActivationCheck;
//# sourceMappingURL=activation-check.js.map