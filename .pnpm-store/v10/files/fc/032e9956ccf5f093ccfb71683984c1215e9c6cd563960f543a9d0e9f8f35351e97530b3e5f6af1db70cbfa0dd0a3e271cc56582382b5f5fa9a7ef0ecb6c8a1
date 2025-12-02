"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Profiles = void 0;
const resource_1 = require("../../resource.js");
class Profiles extends resource_1.APIResource {
    /**
     * Gets the current billing profile for the account.
     *
     * @deprecated
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/billing/profile`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Profiles = Profiles;
//# sourceMappingURL=profiles.js.map