// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class AdvertisementStatus extends APIResource {
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
//# sourceMappingURL=advertisement-status.mjs.map