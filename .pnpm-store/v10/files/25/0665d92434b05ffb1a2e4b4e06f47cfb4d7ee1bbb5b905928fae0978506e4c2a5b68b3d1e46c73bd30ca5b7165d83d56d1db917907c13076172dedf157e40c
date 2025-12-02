// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class PrebuiltPolicies extends APIResource {
    /**
     * List prebuilt catalog sync policies (Closed Beta).
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/magic/cloud/catalog-syncs/prebuilt-policies`, PrebuiltPolicyListResponsesSinglePage, { query, ...options });
    }
}
export class PrebuiltPolicyListResponsesSinglePage extends SinglePage {
}
PrebuiltPolicies.PrebuiltPolicyListResponsesSinglePage = PrebuiltPolicyListResponsesSinglePage;
//# sourceMappingURL=prebuilt-policies.mjs.map