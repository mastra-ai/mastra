// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../resource.mjs";
export class DCVDelegation extends APIResource {
    /**
     * Retrieve the account and zone specific unique identifier used as part of the
     * CNAME target for DCV Delegation.
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/dcv_delegation/uuid`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=dcv-delegation.mjs.map