"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASN = void 0;
const resource_1 = require("../../resource.js");
class ASN extends resource_1.APIResource {
    /**
     * Gets all the data the botnet tracking database has for a given ASN registered to
     * user account for given date. If no date is given, it will return results for the
     * previous day.
     */
    dayReport(asnId, params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/botnet_feed/asn/${asnId}/day_report`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Gets all the data the botnet threat feed tracking database has for a given ASN
     * registered to user account.
     */
    fullReport(asnId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/botnet_feed/asn/${asnId}/full_report`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.ASN = ASN;
//# sourceMappingURL=asn.js.map