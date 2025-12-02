import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as Shared from "../../../shared.js";
import * as GroupsAPI from "./groups.js";
import { Group, GroupEditParams, GroupEditResponse, GroupGetParams, GroupGetResponse, GroupListParams, Groups, GroupsV4PagePaginationArray } from "./groups.js";
import * as RulesAPI from "./rules.js";
import { AllowedModesAnomaly, RuleEditParams, RuleEditResponse, RuleGetParams, RuleGetResponse, RuleListParams, RuleListResponse, RuleListResponsesV4PagePaginationArray, Rules, WAFRuleGroup } from "./rules.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../../pagination.js";
export declare class Packages extends APIResource {
    groups: GroupsAPI.Groups;
    rules: RulesAPI.Rules;
    /**
     * Fetches WAF packages for a zone.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    list(params: PackageListParams, options?: Core.RequestOptions): Core.PagePromise<PackageListResponsesV4PagePaginationArray, PackageListResponse>;
    /**
     * Fetches the details of a WAF package.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    get(packageId: string, params: PackageGetParams, options?: Core.RequestOptions): Core.APIPromise<PackageGetResponse>;
}
export declare class PackageListResponsesV4PagePaginationArray extends V4PagePaginationArray<PackageListResponse> {
}
export type PackageListResponse = unknown;
export type PackageGetResponse = PackageGetResponse.FirewallAPIResponseSingle | PackageGetResponse.Result;
export declare namespace PackageGetResponse {
    interface FirewallAPIResponseSingle {
        errors: Array<Shared.ResponseInfo>;
        messages: Array<Shared.ResponseInfo>;
        result: unknown | string | null;
        /**
         * Defines whether the API call was successful.
         */
        success: true;
    }
    interface Result {
        result?: unknown;
    }
}
export interface PackageListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Query param: The direction used to sort returned packages.
     */
    direction?: 'asc' | 'desc';
    /**
     * Query param: When set to `all`, all the search requirements must match. When set
     * to `any`, only one of the search requirements has to match.
     */
    match?: 'any' | 'all';
    /**
     * Query param: The name of the WAF package.
     */
    name?: string;
    /**
     * Query param: The field used to sort returned packages.
     */
    order?: 'name';
}
export interface PackageGetParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export declare namespace Packages {
    export { type PackageListResponse as PackageListResponse, type PackageGetResponse as PackageGetResponse, PackageListResponsesV4PagePaginationArray as PackageListResponsesV4PagePaginationArray, type PackageListParams as PackageListParams, type PackageGetParams as PackageGetParams, };
    export { Groups as Groups, type Group as Group, type GroupEditResponse as GroupEditResponse, type GroupGetResponse as GroupGetResponse, GroupsV4PagePaginationArray as GroupsV4PagePaginationArray, type GroupListParams as GroupListParams, type GroupEditParams as GroupEditParams, type GroupGetParams as GroupGetParams, };
    export { Rules as Rules, type AllowedModesAnomaly as AllowedModesAnomaly, type WAFRuleGroup as WAFRuleGroup, type RuleListResponse as RuleListResponse, type RuleEditResponse as RuleEditResponse, type RuleGetResponse as RuleGetResponse, RuleListResponsesV4PagePaginationArray as RuleListResponsesV4PagePaginationArray, type RuleListParams as RuleListParams, type RuleEditParams as RuleEditParams, type RuleGetParams as RuleGetParams, };
}
//# sourceMappingURL=packages.d.ts.map