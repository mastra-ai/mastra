"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserGroupListResponsesV4PagePaginationArray = exports.UserGroups = void 0;
const resource_1 = require("../../../resource.js");
const MembersAPI = __importStar(require("./members.js"));
const members_1 = require("./members.js");
const pagination_1 = require("../../../pagination.js");
class UserGroups extends resource_1.APIResource {
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
exports.UserGroups = UserGroups;
class UserGroupListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.UserGroupListResponsesV4PagePaginationArray = UserGroupListResponsesV4PagePaginationArray;
UserGroups.UserGroupListResponsesV4PagePaginationArray = UserGroupListResponsesV4PagePaginationArray;
UserGroups.Members = members_1.Members;
UserGroups.MemberUpdateResponsesSinglePage = members_1.MemberUpdateResponsesSinglePage;
UserGroups.MemberListResponsesV4PagePaginationArray = members_1.MemberListResponsesV4PagePaginationArray;
//# sourceMappingURL=user-groups.js.map