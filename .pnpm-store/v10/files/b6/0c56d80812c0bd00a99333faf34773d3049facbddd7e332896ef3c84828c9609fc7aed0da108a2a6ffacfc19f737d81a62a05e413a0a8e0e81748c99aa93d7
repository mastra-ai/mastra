// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { V4PagePaginationArray } from "../../../../pagination.mjs";
export class Rules extends APIResource {
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
export class RuleListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Rules.RuleListResponsesV4PagePaginationArray = RuleListResponsesV4PagePaginationArray;
//# sourceMappingURL=rules.mjs.map