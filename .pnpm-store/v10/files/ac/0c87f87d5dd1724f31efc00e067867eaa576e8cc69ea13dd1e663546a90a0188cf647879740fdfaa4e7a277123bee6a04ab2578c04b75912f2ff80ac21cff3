// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage, V4PagePaginationArray } from "../../../pagination.mjs";
export class Members extends APIResource {
    /**
     * Add members to a User Group.
     *
     * @example
     * ```ts
     * const member = await client.iam.userGroups.members.create(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: [{ id: '023e105f4ecef8ad9ca31a8372d0c353' }],
     *   },
     * );
     * ```
     */
    create(userGroupId, params, options) {
        const { account_id, body } = params;
        return this._client.post(`/accounts/${account_id}/iam/user_groups/${userGroupId}/members`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Replace the set of members attached to a User Group.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const memberUpdateResponse of client.iam.userGroups.members.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: [{ id: '023e105f4ecef8ad9ca31a8372d0c353' }],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    update(userGroupId, params, options) {
        const { account_id, body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/iam/user_groups/${userGroupId}/members`, MemberUpdateResponsesSinglePage, { body: body, method: 'put', ...options });
    }
    /**
     * List all the members attached to a user group.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const memberListResponse of client.iam.userGroups.members.list(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(userGroupId, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/iam/user_groups/${userGroupId}/members`, MemberListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Remove a member from User Group
     *
     * @example
     * ```ts
     * const member = await client.iam.userGroups.members.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(userGroupId, memberId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/iam/user_groups/${userGroupId}/members/${memberId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class MemberUpdateResponsesSinglePage extends SinglePage {
}
export class MemberListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Members.MemberUpdateResponsesSinglePage = MemberUpdateResponsesSinglePage;
Members.MemberListResponsesV4PagePaginationArray = MemberListResponsesV4PagePaginationArray;
//# sourceMappingURL=members.mjs.map