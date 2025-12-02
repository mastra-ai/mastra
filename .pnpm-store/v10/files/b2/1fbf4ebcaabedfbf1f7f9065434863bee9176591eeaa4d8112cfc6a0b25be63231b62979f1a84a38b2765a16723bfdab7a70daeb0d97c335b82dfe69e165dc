"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASN = void 0;
const resource_1 = require("../../../resource.js");
class ASN extends resource_1.APIResource {
    /**
     * Delete an ASN from botnet threat feed for a given user.
     */
    delete(asnId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/botnet_feed/configs/asn/${asnId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Gets a list of all ASNs registered for a user for the DDoS Botnet Feed API.
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/botnet_feed/configs/asn`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.ASN = ASN;
//# sourceMappingURL=asn.js.map