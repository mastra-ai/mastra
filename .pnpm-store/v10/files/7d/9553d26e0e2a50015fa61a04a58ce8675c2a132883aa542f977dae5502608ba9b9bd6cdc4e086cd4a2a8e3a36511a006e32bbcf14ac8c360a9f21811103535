// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as GroupsAPI from "./groups.mjs";
import { Groups, GroupsV4PagePaginationArray, } from "./groups.mjs";
import * as RulesAPI from "./rules.mjs";
import { RuleListResponsesV4PagePaginationArray, Rules, } from "./rules.mjs";
import { V4PagePaginationArray } from "../../../../pagination.mjs";
export class Packages extends APIResource {
    constructor() {
        super(...arguments);
        this.groups = new GroupsAPI.Groups(this._client);
        this.rules = new RulesAPI.Rules(this._client);
    }
    /**
     * Fetches WAF packages for a zone.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/firewall/waf/packages`, PackageListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Fetches the details of a WAF package.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    get(packageId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/firewall/waf/packages/${packageId}`, options);
    }
}
export class PackageListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Packages.PackageListResponsesV4PagePaginationArray = PackageListResponsesV4PagePaginationArray;
Packages.Groups = Groups;
Packages.GroupsV4PagePaginationArray = GroupsV4PagePaginationArray;
Packages.Rules = Rules;
Packages.RuleListResponsesV4PagePaginationArray = RuleListResponsesV4PagePaginationArray;
//# sourceMappingURL=packages.mjs.map