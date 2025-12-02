import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as PoliciesAPI from "./applications/policies.js";
import { SinglePage } from "../../../pagination.js";
export declare class Groups extends APIResource {
    /**
     * Creates a new Access group.
     *
     * @example
     * ```ts
     * const group = await client.zeroTrust.access.groups.create({
     *   include: [
     *     {
     *       group: { id: 'aa0a4aab-672b-4bdb-bc33-a59f1130a11f' },
     *     },
     *   ],
     *   name: 'Allow devs',
     *   account_id: 'account_id',
     * });
     * ```
     */
    create(params: GroupCreateParams, options?: Core.RequestOptions): Core.APIPromise<GroupCreateResponse>;
    /**
     * Updates a configured Access group.
     *
     * @example
     * ```ts
     * const group = await client.zeroTrust.access.groups.update(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   {
     *     include: [
     *       {
     *         group: {
     *           id: 'aa0a4aab-672b-4bdb-bc33-a59f1130a11f',
     *         },
     *       },
     *     ],
     *     name: 'Allow devs',
     *     account_id: 'account_id',
     *   },
     * );
     * ```
     */
    update(groupId: string, params: GroupUpdateParams, options?: Core.RequestOptions): Core.APIPromise<GroupUpdateResponse>;
    /**
     * Lists all Access groups.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const groupListResponse of client.zeroTrust.access.groups.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params?: GroupListParams, options?: Core.RequestOptions): Core.PagePromise<GroupListResponsesSinglePage, GroupListResponse>;
    list(options?: Core.RequestOptions): Core.PagePromise<GroupListResponsesSinglePage, GroupListResponse>;
    /**
     * Deletes an Access group.
     *
     * @example
     * ```ts
     * const group = await client.zeroTrust.access.groups.delete(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    delete(groupId: string, params?: GroupDeleteParams, options?: Core.RequestOptions): Core.APIPromise<GroupDeleteResponse>;
    delete(groupId: string, options?: Core.RequestOptions): Core.APIPromise<GroupDeleteResponse>;
    /**
     * Fetches a single Access group.
     *
     * @example
     * ```ts
     * const group = await client.zeroTrust.access.groups.get(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(groupId: string, params?: GroupGetParams, options?: Core.RequestOptions): Core.APIPromise<GroupGetResponse>;
    get(groupId: string, options?: Core.RequestOptions): Core.APIPromise<GroupGetResponse>;
}
export declare class GroupListResponsesSinglePage extends SinglePage<GroupListResponse> {
}
export declare class ZeroTrustGroupsSinglePage extends SinglePage<ZeroTrustGroup> {
}
export interface ZeroTrustGroup {
    /**
     * The unique Cloudflare-generated Id of the SCIM resource.
     */
    id?: string;
    /**
     * The display name of the SCIM Group resource.
     */
    displayName?: string;
    /**
     * The IdP-generated Id of the SCIM resource.
     */
    externalId?: string;
    /**
     * The metadata of the SCIM resource.
     */
    meta?: ZeroTrustGroup.Meta;
    /**
     * The list of URIs which indicate the attributes contained within a SCIM resource.
     */
    schemas?: Array<string>;
}
export declare namespace ZeroTrustGroup {
    /**
     * The metadata of the SCIM resource.
     */
    interface Meta {
        /**
         * The timestamp of when the SCIM resource was created.
         */
        created?: string;
        /**
         * The timestamp of when the SCIM resource was last modified.
         */
        lastModified?: string;
    }
}
export interface GroupCreateResponse {
    /**
     * UUID.
     */
    id?: string;
    created_at?: string;
    /**
     * Rules evaluated with a NOT logical operator. To match a policy, a user cannot
     * meet any of the Exclude rules.
     */
    exclude?: Array<PoliciesAPI.AccessRule>;
    /**
     * Rules evaluated with an OR logical operator. A user needs to meet only one of
     * the Include rules.
     */
    include?: Array<PoliciesAPI.AccessRule>;
    /**
     * Rules evaluated with an AND logical operator. To match a policy, a user must
     * meet all of the Require rules.
     */
    is_default?: Array<PoliciesAPI.AccessRule>;
    /**
     * The name of the Access group.
     */
    name?: string;
    /**
     * Rules evaluated with an AND logical operator. To match a policy, a user must
     * meet all of the Require rules.
     */
    require?: Array<PoliciesAPI.AccessRule>;
    updated_at?: string;
}
export interface GroupUpdateResponse {
    /**
     * UUID.
     */
    id?: string;
    created_at?: string;
    /**
     * Rules evaluated with a NOT logical operator. To match a policy, a user cannot
     * meet any of the Exclude rules.
     */
    exclude?: Array<PoliciesAPI.AccessRule>;
    /**
     * Rules evaluated with an OR logical operator. A user needs to meet only one of
     * the Include rules.
     */
    include?: Array<PoliciesAPI.AccessRule>;
    /**
     * Rules evaluated with an AND logical operator. To match a policy, a user must
     * meet all of the Require rules.
     */
    is_default?: Array<PoliciesAPI.AccessRule>;
    /**
     * The name of the Access group.
     */
    name?: string;
    /**
     * Rules evaluated with an AND logical operator. To match a policy, a user must
     * meet all of the Require rules.
     */
    require?: Array<PoliciesAPI.AccessRule>;
    updated_at?: string;
}
export interface GroupListResponse {
    /**
     * UUID.
     */
    id?: string;
    created_at?: string;
    /**
     * Rules evaluated with a NOT logical operator. To match a policy, a user cannot
     * meet any of the Exclude rules.
     */
    exclude?: Array<PoliciesAPI.AccessRule>;
    /**
     * Rules evaluated with an OR logical operator. A user needs to meet only one of
     * the Include rules.
     */
    include?: Array<PoliciesAPI.AccessRule>;
    /**
     * Rules evaluated with an AND logical operator. To match a policy, a user must
     * meet all of the Require rules.
     */
    is_default?: Array<PoliciesAPI.AccessRule>;
    /**
     * The name of the Access group.
     */
    name?: string;
    /**
     * Rules evaluated with an AND logical operator. To match a policy, a user must
     * meet all of the Require rules.
     */
    require?: Array<PoliciesAPI.AccessRule>;
    updated_at?: string;
}
export interface GroupDeleteResponse {
    /**
     * UUID.
     */
    id?: string;
}
export interface GroupGetResponse {
    /**
     * UUID.
     */
    id?: string;
    created_at?: string;
    /**
     * Rules evaluated with a NOT logical operator. To match a policy, a user cannot
     * meet any of the Exclude rules.
     */
    exclude?: Array<PoliciesAPI.AccessRule>;
    /**
     * Rules evaluated with an OR logical operator. A user needs to meet only one of
     * the Include rules.
     */
    include?: Array<PoliciesAPI.AccessRule>;
    /**
     * Rules evaluated with an AND logical operator. To match a policy, a user must
     * meet all of the Require rules.
     */
    is_default?: Array<PoliciesAPI.AccessRule>;
    /**
     * The name of the Access group.
     */
    name?: string;
    /**
     * Rules evaluated with an AND logical operator. To match a policy, a user must
     * meet all of the Require rules.
     */
    require?: Array<PoliciesAPI.AccessRule>;
    updated_at?: string;
}
export interface GroupCreateParams {
    /**
     * Body param: Rules evaluated with an OR logical operator. A user needs to meet
     * only one of the Include rules.
     */
    include: Array<PoliciesAPI.AccessRuleParam>;
    /**
     * Body param: The name of the Access group.
     */
    name: string;
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
    /**
     * Body param: Rules evaluated with a NOT logical operator. To match a policy, a
     * user cannot meet any of the Exclude rules.
     */
    exclude?: Array<PoliciesAPI.AccessRuleParam>;
    /**
     * Body param: Whether this is the default group
     */
    is_default?: boolean;
    /**
     * Body param: Rules evaluated with an AND logical operator. To match a policy, a
     * user must meet all of the Require rules.
     */
    require?: Array<PoliciesAPI.AccessRuleParam>;
}
export interface GroupUpdateParams {
    /**
     * Body param: Rules evaluated with an OR logical operator. A user needs to meet
     * only one of the Include rules.
     */
    include: Array<PoliciesAPI.AccessRuleParam>;
    /**
     * Body param: The name of the Access group.
     */
    name: string;
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
    /**
     * Body param: Rules evaluated with a NOT logical operator. To match a policy, a
     * user cannot meet any of the Exclude rules.
     */
    exclude?: Array<PoliciesAPI.AccessRuleParam>;
    /**
     * Body param: Whether this is the default group
     */
    is_default?: boolean;
    /**
     * Body param: Rules evaluated with an AND logical operator. To match a policy, a
     * user must meet all of the Require rules.
     */
    require?: Array<PoliciesAPI.AccessRuleParam>;
}
export interface GroupListParams {
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
    /**
     * Query param: The name of the group.
     */
    name?: string;
    /**
     * Query param: Search for groups by other listed query parameters.
     */
    search?: string;
}
export interface GroupDeleteParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export interface GroupGetParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export declare namespace Groups {
    export { type ZeroTrustGroup as ZeroTrustGroup, type GroupCreateResponse as GroupCreateResponse, type GroupUpdateResponse as GroupUpdateResponse, type GroupListResponse as GroupListResponse, type GroupDeleteResponse as GroupDeleteResponse, type GroupGetResponse as GroupGetResponse, GroupListResponsesSinglePage as GroupListResponsesSinglePage, type GroupCreateParams as GroupCreateParams, type GroupUpdateParams as GroupUpdateParams, type GroupListParams as GroupListParams, type GroupDeleteParams as GroupDeleteParams, type GroupGetParams as GroupGetParams, };
}
//# sourceMappingURL=groups.d.ts.map