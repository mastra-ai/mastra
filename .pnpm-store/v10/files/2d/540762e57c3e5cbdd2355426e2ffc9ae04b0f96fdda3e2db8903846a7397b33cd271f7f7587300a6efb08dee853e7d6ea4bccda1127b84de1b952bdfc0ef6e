import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../../pagination.js";
export declare class Groups extends APIResource {
    /**
     * Fetches the WAF rule groups in a WAF package.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    list(packageId: string, params: GroupListParams, options?: Core.RequestOptions): Core.PagePromise<GroupsV4PagePaginationArray, Group>;
    /**
     * Updates a WAF rule group. You can update the state (`mode` parameter) of a rule
     * group.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    edit(packageId: string, groupId: string, params: GroupEditParams, options?: Core.RequestOptions): Core.APIPromise<GroupEditResponse>;
    /**
     * Fetches the details of a WAF rule group.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    get(packageId: string, groupId: string, params: GroupGetParams, options?: Core.RequestOptions): Core.APIPromise<GroupGetResponse>;
}
export declare class GroupsV4PagePaginationArray extends V4PagePaginationArray<Group> {
}
export interface Group {
    /**
     * Defines the unique identifier of the rule group.
     */
    id: string;
    /**
     * Defines an informative summary of what the rule group does.
     */
    description: string | null;
    /**
     * Defines the state of the rules contained in the rule group. When `on`, the rules
     * in the group are configurable/usable.
     */
    mode: 'on' | 'off';
    /**
     * Defines the name of the rule group.
     */
    name: string;
    /**
     * Defines the number of rules in the current rule group.
     */
    rules_count: number;
    /**
     * Defines the available states for the rule group.
     */
    allowed_modes?: Array<'on' | 'off'>;
    /**
     * Defines the number of rules within the group that have been modified from their
     * default configuration.
     */
    modified_rules_count?: number;
    /**
     * Defines the unique identifier of a WAF package.
     */
    package_id?: string;
}
export type GroupEditResponse = unknown | string | null;
export type GroupGetResponse = unknown | string | null;
export interface GroupListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Defines an identifier of a schema.
     */
    zone_id: string;
    /**
     * Query param: Defines the direction used to sort returned rule groups.
     */
    direction?: 'asc' | 'desc';
    /**
     * Query param: Defines the condition for search requirements. When set to `all`,
     * all the search requirements must match. When set to `any`, only one of the
     * search requirements has to match.
     */
    match?: 'any' | 'all';
    /**
     * Query param: Defines the state of the rules contained in the rule group. When
     * `on`, the rules in the group are configurable/usable.
     */
    mode?: 'on' | 'off';
    /**
     * Query param: Defines the name of the rule group.
     */
    name?: string;
    /**
     * Query param: Defines the field used to sort returned rule groups.
     */
    order?: 'mode' | 'rules_count';
    /**
     * Query param: Defines the number of rules in the current rule group.
     */
    rules_count?: number;
}
export interface GroupEditParams {
    /**
     * Path param: Defines an identifier of a schema.
     */
    zone_id: string;
    /**
     * Body param: Defines the state of the rules contained in the rule group. When
     * `on`, the rules in the group are configurable/usable.
     */
    mode?: 'on' | 'off';
}
export interface GroupGetParams {
    /**
     * Defines an identifier of a schema.
     */
    zone_id: string;
}
export declare namespace Groups {
    export { type Group as Group, type GroupEditResponse as GroupEditResponse, type GroupGetResponse as GroupGetResponse, GroupsV4PagePaginationArray as GroupsV4PagePaginationArray, type GroupListParams as GroupListParams, type GroupEditParams as GroupEditParams, type GroupGetParams as GroupGetParams, };
}
//# sourceMappingURL=groups.d.ts.map