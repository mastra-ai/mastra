"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvertisementStatus = void 0;
const resource_1 = require("../../../resource.js");
class AdvertisementStatus extends resource_1.APIResource {
    /**
     * Advertise or withdraw the BGP route for a prefix.
     *
     * **Deprecated:** Prefer the BGP Prefixes endpoints, which additionally allow for
     * advertising and withdrawing subnets of an IP prefix.
     *
     * @deprecated
     */
    edit(prefixId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/addressing/prefixes/${prefixId}/bgp/status`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * View the current advertisement state for a prefix.
     *
     * **Deprecated:** Prefer the BGP Prefixes endpoints, which additionally allow for
     * advertising and withdrawing subnets of an IP prefix.
     *
     * @deprecated
     */
    get(prefixId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/addressing/prefixes/${prefixId}/bgp/status`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.AdvertisementStatus = AdvertisementStatus;
//# sourceMappingURL=advertisement-status.js.map