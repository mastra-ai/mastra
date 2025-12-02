"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Attackers = void 0;
const resource_1 = require("../../../resource.js");
class Attackers extends resource_1.APIResource {
    /**
     * Lists attackers
     *
     * @example
     * ```ts
     * const attackers =
     *   await client.cloudforceOne.threatEvents.attackers.list({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/events/attackers`, options);
    }
}
exports.Attackers = Attackers;
//# sourceMappingURL=attackers.js.map