"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressSpaces = void 0;
const resource_1 = require("../../../resource.js");
class AddressSpaces extends resource_1.APIResource {
    /**
     * Update the Magic WAN Address Space (Closed Beta).
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/magic/cloud/onramps/magic_wan_address_space`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Read the Magic WAN Address Space (Closed Beta).
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/magic/cloud/onramps/magic_wan_address_space`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update the Magic WAN Address Space (Closed Beta).
     */
    edit(params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/magic/cloud/onramps/magic_wan_address_space`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.AddressSpaces = AddressSpaces;
//# sourceMappingURL=address-spaces.js.map