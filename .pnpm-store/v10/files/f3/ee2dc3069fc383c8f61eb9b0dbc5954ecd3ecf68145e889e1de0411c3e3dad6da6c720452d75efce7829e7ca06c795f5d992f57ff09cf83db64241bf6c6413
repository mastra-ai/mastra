// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class ASN extends APIResource {
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
//# sourceMappingURL=asn.mjs.map