// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as MembersAPI from "./members.mjs";
import { MemberListResponsesV4PagePaginationArray, MemberUpdateResponsesSinglePage, Members, } from "./members.mjs";
import { V4PagePaginationArray } from "../../../pagination.mjs";
export class UserGroups extends APIResource {
    constructor() {
        super(...arguments);
        this.members = new MembersAPI.Members(this._client);
    }
    /**
     * Create a new user group under the specified account.
     *
     * @example
     * ```ts
     * const userGroup = await client.iam.userGroups.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'My New User Group',
     *   policies: [
     *     {
     *       access: 'allow',
     *       permission_groups: [
     *         { id: 'c8fed203ed3043cba015a93ad1616f1f' },
     *         { id: '82e64a83756745bbbb1c9c2701bf816b' },
     *       ],
     *       resource_groups: [
     *         { id: '6d7f2f5f5b1d4a0e9081fdc98d432fd1' },
     *       ],
     *     },
     *   ],
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/iam/user_groups`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Modify an existing user group.
     *
     * @example
     * ```ts
     * const userGroup = await client.iam.userGroups.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(userGroupId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/iam/user_groups/${userGroupId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List all the user groups for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const userGroupListResponse of client.iam.userGroups.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/iam/user_groups`, UserGroupListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Remove a user group from an account.
     *
     * @example
     * ```ts
     * const userGroup = await client.iam.userGroups.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(userGroupId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/iam/user_groups/${userGroupId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get information about a specific user group in an account.
     *
     * @example
     * ```ts
     * const userGroup = await client.iam.userGroups.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(userGroupId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/iam/user_groups/${userGroupId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class UserGroupListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
UserGroups.UserGroupListResponsesV4PagePaginationArray = UserGroupListResponsesV4PagePaginationArray;
UserGroups.Members = Members;
UserGroups.MemberUpdateResponsesSinglePage = MemberUpdateResponsesSinglePage;
UserGroups.MemberListResponsesV4PagePaginationArray = MemberListResponsesV4PagePaginationArray;
//# sourceMappingURL=user-groups.mjs.map