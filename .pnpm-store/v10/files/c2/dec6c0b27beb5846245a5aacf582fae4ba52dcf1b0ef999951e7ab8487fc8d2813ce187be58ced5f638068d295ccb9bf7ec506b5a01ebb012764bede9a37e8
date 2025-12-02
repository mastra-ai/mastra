// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class PermissionGroups extends APIResource {
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
export class PermissionGroupListResponsesSinglePage extends SinglePage {
}
PermissionGroups.PermissionGroupListResponsesSinglePage = PermissionGroupListResponsesSinglePage;
//# sourceMappingURL=permission-groups.mjs.map