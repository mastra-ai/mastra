// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage, V4PagePaginationArray } from "../../pagination.mjs";
/**
 * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
 */
export class Rules extends APIResource {
    /**
     * Create one or more firewall rules.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.getAPIList(`/zones/${zone_id}/firewall/rules`, FirewallRulesSinglePage, {
            body,
            method: 'post',
            ...options,
        });
    }
    /**
     * Updates an existing firewall rule.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    update(ruleId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/firewall/rules/${ruleId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches firewall rules in a zone. You can filter the results using several
     * optional parameters.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/firewall/rules`, FirewallRulesV4PagePaginationArray, {
            query,
            ...options,
        });
    }
    /**
     * Deletes an existing firewall rule.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    delete(ruleId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/firewall/rules/${ruleId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes existing firewall rules.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    bulkDelete(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/firewall/rules`, FirewallRulesSinglePage, {
            method: 'delete',
            ...options,
        });
    }
    /**
     * Updates the priority of existing firewall rules.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    bulkEdit(params, options) {
        const { zone_id, body } = params;
        return this._client.getAPIList(`/zones/${zone_id}/firewall/rules`, FirewallRulesSinglePage, {
            body: body,
            method: 'patch',
            ...options,
        });
    }
    /**
     * Updates one or more existing firewall rules.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    bulkUpdate(params, options) {
        const { zone_id, body } = params;
        return this._client.getAPIList(`/zones/${zone_id}/firewall/rules`, FirewallRulesSinglePage, {
            body: body,
            method: 'put',
            ...options,
        });
    }
    /**
     * Updates the priority of an existing firewall rule.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    edit(ruleId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.getAPIList(`/zones/${zone_id}/firewall/rules/${ruleId}`, FirewallRulesSinglePage, {
            body,
            method: 'patch',
            ...options,
        });
    }
    /**
     * Fetches the details of a firewall rule.
     *
     * @deprecated The Firewall Rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    get(ruleId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/firewall/rules/${ruleId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class FirewallRulesSinglePage extends SinglePage {
}
export class FirewallRulesV4PagePaginationArray extends V4PagePaginationArray {
}
Rules.FirewallRulesSinglePage = FirewallRulesSinglePage;
Rules.FirewallRulesV4PagePaginationArray = FirewallRulesV4PagePaginationArray;
//# sourceMappingURL=rules.mjs.map