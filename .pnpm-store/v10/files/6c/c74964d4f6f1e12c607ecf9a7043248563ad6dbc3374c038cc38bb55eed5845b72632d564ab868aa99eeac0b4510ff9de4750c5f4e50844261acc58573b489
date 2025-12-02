"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverridesV4PagePaginationArray = exports.Overrides = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Overrides extends resource_1.APIResource {
    /**
     * Creates a URI-based WAF override for a zone.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/firewall/waf/overrides`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an existing URI-based WAF override.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    update(overridesId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/firewall/waf/overrides/${overridesId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the URI-based WAF overrides in a zone.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/firewall/waf/overrides`, OverridesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletes an existing URI-based WAF override.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    delete(overridesId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/firewall/waf/overrides/${overridesId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the details of a URI-based WAF override.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    get(overridesId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/firewall/waf/overrides/${overridesId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Overrides = Overrides;
class OverridesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.OverridesV4PagePaginationArray = OverridesV4PagePaginationArray;
Overrides.OverridesV4PagePaginationArray = OverridesV4PagePaginationArray;
//# sourceMappingURL=overrides.js.map