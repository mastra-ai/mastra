// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Rules extends APIResource {
    /**
     * Put Rules
     */
    update(params, options) {
        const { zone_id, rules } = params ?? {};
        return this._client.getAPIList(`/zones/${zone_id}/cloud_connector/rules`, RuleUpdateResponsesSinglePage, {
            body: rules,
            method: 'put',
            ...options,
        });
    }
    /**
     * Rules
     */
    list(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/cloud_connector/rules`, RuleListResponsesSinglePage, options);
    }
}
export class RuleUpdateResponsesSinglePage extends SinglePage {
}
export class RuleListResponsesSinglePage extends SinglePage {
}
Rules.RuleUpdateResponsesSinglePage = RuleUpdateResponsesSinglePage;
Rules.RuleListResponsesSinglePage = RuleListResponsesSinglePage;
//# sourceMappingURL=rules.mjs.map