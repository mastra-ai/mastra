"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrebuiltPolicyListResponsesSinglePage = exports.PrebuiltPolicies = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class PrebuiltPolicies extends resource_1.APIResource {
    /**
     * List prebuilt catalog sync policies (Closed Beta).
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/magic/cloud/catalog-syncs/prebuilt-policies`, PrebuiltPolicyListResponsesSinglePage, { query, ...options });
    }
}
exports.PrebuiltPolicies = PrebuiltPolicies;
class PrebuiltPolicyListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.PrebuiltPolicyListResponsesSinglePage = PrebuiltPolicyListResponsesSinglePage;
PrebuiltPolicies.PrebuiltPolicyListResponsesSinglePage = PrebuiltPolicyListResponsesSinglePage;
//# sourceMappingURL=prebuilt-policies.js.map