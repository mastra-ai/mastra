import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class PermissionGroups extends APIResource {
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
    list(params: PermissionGroupListParams, options?: Core.RequestOptions): Core.PagePromise<PermissionGroupListResponsesV4PagePaginationArray, PermissionGroupListResponse>;
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
    get(permissionGroupId: string, params: PermissionGroupGetParams, options?: Core.RequestOptions): Core.APIPromise<PermissionGroupGetResponse>;
}
export declare class PermissionGroupListResponsesV4PagePaginationArray extends V4PagePaginationArray<PermissionGroupListResponse> {
}
/**
 * A named group of permissions that map to a group of operations against
 * resources.
 */
export interface PermissionGroupListResponse {
    /**
     * Identifier of the permission group.
     */
    id: string;
    /**
     * Attributes associated to the permission group.
     */
    meta?: PermissionGroupListResponse.Meta;
    /**
     * Name of the permission group.
     */
    name?: string;
}
export declare namespace PermissionGroupListResponse {
    /**
     * Attributes associated to the permission group.
     */
    interface Meta {
        key?: string;
        value?: string;
    }
}
/**
 * A named group of permissions that map to a group of operations against
 * resources.
 */
export interface PermissionGroupGetResponse {
    /**
     * Identifier of the permission group.
     */
    id: string;
    /**
     * Attributes associated to the permission group.
     */
    meta?: PermissionGroupGetResponse.Meta;
    /**
     * Name of the permission group.
     */
    name?: string;
}
export declare namespace PermissionGroupGetResponse {
    /**
     * Attributes associated to the permission group.
     */
    interface Meta {
        key?: string;
        value?: string;
    }
}
export interface PermissionGroupListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;
    /**
     * Query param: ID of the permission group to be fetched.
     */
    id?: string;
    /**
     * Query param: Label of the permission group to be fetched.
     */
    label?: string;
    /**
     * Query param: Name of the permission group to be fetched.
     */
    name?: string;
}
export interface PermissionGroupGetParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export declare namespace PermissionGroups {
    export { type PermissionGroupListResponse as PermissionGroupListResponse, type PermissionGroupGetResponse as PermissionGroupGetResponse, PermissionGroupListResponsesV4PagePaginationArray as PermissionGroupListResponsesV4PagePaginationArray, type PermissionGroupListParams as PermissionGroupListParams, type PermissionGroupGetParams as PermissionGroupGetParams, };
}
//# sourceMappingURL=permission-groups.d.ts.map