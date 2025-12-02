"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DCVDelegation = void 0;
const resource_1 = require("../resource.js");
class DCVDelegation extends resource_1.APIResource {
    /**
     * Retrieve the account and zone specific unique identifier used as part of the
     * CNAME target for DCV Delegation.
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/dcv_delegation/uuid`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.DCVDelegation = DCVDelegation;
//# sourceMappingURL=dcv-delegation.js.map