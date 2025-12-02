// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class PermissionGroups extends APIResource {
    /**
     * List all the permissions groups for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const permissionGroupListResponse of client.iam.permissionGroups.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/iam/permission_groups`, PermissionGroupListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Get information about a specific permission group in an account.
     *
     * @example
     * ```ts
     * const permissionGroup =
     *   await client.iam.permissionGroups.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(permissionGroupId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/iam/permission_groups/${permissionGroupId}`, options);
    }
}
export class PermissionGroupListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
PermissionGroups.PermissionGroupListResponsesV4PagePaginationArray =
    PermissionGroupListResponsesV4PagePaginationArray;
//# sourceMappingURL=permission-groups.mjs.map