"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionGroupListResponsesSinglePage = exports.PermissionGroups = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class PermissionGroups extends resource_1.APIResource {
    /**
     * Find all available permission groups for Account Owned API Tokens
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const permissionGroupListResponse of client.accounts.tokens.permissionGroups.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/tokens/permission_groups`, PermissionGroupListResponsesSinglePage, { query, ...options });
    }
    /**
     * Find all available permission groups for Account Owned API Tokens
     *
     * @example
     * ```ts
     * const permissionGroups =
     *   await client.accounts.tokens.permissionGroups.get({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/tokens/permission_groups`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.PermissionGroups = PermissionGroups;
class PermissionGroupListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.PermissionGroupListResponsesSinglePage = PermissionGroupListResponsesSinglePage;
PermissionGroups.PermissionGroupListResponsesSinglePage = PermissionGroupListResponsesSinglePage;
//# sourceMappingURL=permission-groups.js.map