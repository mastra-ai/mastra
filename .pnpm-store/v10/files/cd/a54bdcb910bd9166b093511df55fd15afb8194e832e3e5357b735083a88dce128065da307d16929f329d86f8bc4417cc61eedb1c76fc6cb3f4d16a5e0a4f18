"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupsV4PagePaginationArray = exports.Groups = void 0;
const resource_1 = require("../../../../resource.js");
const pagination_1 = require("../../../../pagination.js");
class Groups extends resource_1.APIResource {
    /**
     * Fetches the WAF rule groups in a WAF package.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    list(packageId, params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/firewall/waf/packages/${packageId}/groups`, GroupsV4PagePaginationArray, { query, ...options });
    }
    /**
     * Updates a WAF rule group. You can update the state (`mode` parameter) of a rule
     * group.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    edit(packageId, groupId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/firewall/waf/packages/${packageId}/groups/${groupId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the details of a WAF rule group.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    get(packageId, groupId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/firewall/waf/packages/${packageId}/groups/${groupId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Groups = Groups;
class GroupsV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.GroupsV4PagePaginationArray = GroupsV4PagePaginationArray;
Groups.GroupsV4PagePaginationArray = GroupsV4PagePaginationArray;
//# sourceMappingURL=groups.js.map