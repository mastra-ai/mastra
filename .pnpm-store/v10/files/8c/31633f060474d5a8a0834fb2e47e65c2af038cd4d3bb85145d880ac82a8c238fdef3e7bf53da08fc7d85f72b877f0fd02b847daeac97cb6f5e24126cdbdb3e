"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleListResponsesV4PagePaginationArray = exports.Rules = void 0;
const resource_1 = require("../../../../resource.js");
const pagination_1 = require("../../../../pagination.js");
class Rules extends resource_1.APIResource {
    /**
     * Fetches WAF rules in a WAF package.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    list(packageId, params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/firewall/waf/packages/${packageId}/rules`, RuleListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Updates a WAF rule. You can only update the mode/action of the rule.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    edit(packageId, ruleId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/firewall/waf/packages/${packageId}/rules/${ruleId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the details of a WAF rule in a WAF package.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    get(packageId, ruleId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/firewall/waf/packages/${packageId}/rules/${ruleId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Rules = Rules;
class RuleListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.RuleListResponsesV4PagePaginationArray = RuleListResponsesV4PagePaginationArray;
Rules.RuleListResponsesV4PagePaginationArray = RuleListResponsesV4PagePaginationArray;
//# sourceMappingURL=rules.js.map