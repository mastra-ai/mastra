import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class ResourceGroups extends APIResource {
    /**
     * Create a new Resource Group under the specified account.
     *
     * @example
     * ```ts
     * const resourceGroup =
     *   await client.iam.resourceGroups.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     name: 'NewResourceGroup',
     *     scope: {
     *       key: 'com.cloudflare.api.account.eb78d65290b24279ba6f44721b3ea3c4',
     *       objects: [
     *         {
     *           key: 'com.cloudflare.api.account.zone.23f8d65290b24279ba6f44721b3eaad5',
     *         },
     *       ],
     *     },
     *   });
     * ```
     */
    create(params: ResourceGroupCreateParams, options?: Core.RequestOptions): Core.APIPromise<ResourceGroupCreateResponse>;
    /**
     * Modify an existing resource group.
     *
     * @example
     * ```ts
     * const resourceGroup =
     *   await client.iam.resourceGroups.update(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    update(resourceGroupId: string, params: ResourceGroupUpdateParams, options?: Core.RequestOptions): Core.APIPromise<ResourceGroupUpdateResponse>;
    /**
     * List all the resource groups for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const resourceGroupListResponse of client.iam.resourceGroups.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: ResourceGroupListParams, options?: Core.RequestOptions): Core.PagePromise<ResourceGroupListResponsesV4PagePaginationArray, ResourceGroupListResponse>;
    /**
     * Remove a resource group from an account.
     *
     * @example
     * ```ts
     * const resourceGroup =
     *   await client.iam.resourceGroups.delete(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(resourceGroupId: string, params: ResourceGroupDeleteParams, options?: Core.RequestOptions): Core.APIPromise<ResourceGroupDeleteResponse | null>;
    /**
     * Get information about a specific resource group in an account.
     *
     * @example
     * ```ts
     * const resourceGroup = await client.iam.resourceGroups.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(resourceGroupId: string, params: ResourceGroupGetParams, options?: Core.RequestOptions): Core.APIPromise<ResourceGroupGetResponse>;
}
export declare class ResourceGroupListResponsesV4PagePaginationArray extends V4PagePaginationArray<ResourceGroupListResponse> {
}
/**
 * A group of scoped resources.
 */
export interface ResourceGroupCreateResponse {
    /**
     * Identifier of the group.
     */
    id?: string;
    /**
     * Attributes associated to the resource group.
     */
    meta?: unknown;
    /**
     * A scope is a combination of scope objects which provides additional context.
     */
    scope?: ResourceGroupCreateResponse.Scope;
}
export declare namespace ResourceGroupCreateResponse {
    /**
     * A scope is a combination of scope objects which provides additional context.
     */
    interface Scope {
        /**
         * This is a combination of pre-defined resource name and identifier (like Account
         * ID etc.)
         */
        key: string;
        /**
         * A list of scope objects for additional context. The number of Scope objects
         * should not be zero.
         */
        objects: Array<Scope.Object>;
    }
    namespace Scope {
        /**
         * A scope object represents any resource that can have actions applied against
         * invite.
         */
        interface Object {
            /**
             * This is a combination of pre-defined resource name and identifier (like Zone ID
             * etc.)
             */
            key: string;
        }
    }
}
/**
 * A group of scoped resources.
 */
export interface ResourceGroupUpdateResponse {
    /**
     * Identifier of the resource group.
     */
    id: string;
    /**
     * The scope associated to the resource group
     */
    scope: Array<ResourceGroupUpdateResponse.Scope>;
    /**
     * Attributes associated to the resource group.
     */
    meta?: ResourceGroupUpdateResponse.Meta;
    /**
     * Name of the resource group.
     */
    name?: string;
}
export declare namespace ResourceGroupUpdateResponse {
    /**
     * A scope is a combination of scope objects which provides additional context.
     */
    interface Scope {
        /**
         * This is a combination of pre-defined resource name and identifier (like Account
         * ID etc.)
         */
        key: string;
        /**
         * A list of scope objects for additional context.
         */
        objects: Array<Scope.Object>;
    }
    namespace Scope {
        /**
         * A scope object represents any resource that can have actions applied against
         * invite.
         */
        interface Object {
            /**
             * This is a combination of pre-defined resource name and identifier (like Zone ID
             * etc.)
             */
            key: string;
        }
    }
    /**
     * Attributes associated to the resource group.
     */
    interface Meta {
        key?: string;
        value?: string;
    }
}
/**
 * A group of scoped resources.
 */
export interface ResourceGroupListResponse {
    /**
     * Identifier of the resource group.
     */
    id: string;
    /**
     * The scope associated to the resource group
     */
    scope: Array<ResourceGroupListResponse.Scope>;
    /**
     * Attributes associated to the resource group.
     */
    meta?: ResourceGroupListResponse.Meta;
    /**
     * Name of the resource group.
     */
    name?: string;
}
export declare namespace ResourceGroupListResponse {
    /**
     * A scope is a combination of scope objects which provides additional context.
     */
    interface Scope {
        /**
         * This is a combination of pre-defined resource name and identifier (like Account
         * ID etc.)
         */
        key: string;
        /**
         * A list of scope objects for additional context.
         */
        objects: Array<Scope.Object>;
    }
    namespace Scope {
        /**
         * A scope object represents any resource that can have actions applied against
         * invite.
         */
        interface Object {
            /**
             * This is a combination of pre-defined resource name and identifier (like Zone ID
             * etc.)
             */
            key: string;
        }
    }
    /**
     * Attributes associated to the resource group.
     */
    interface Meta {
        key?: string;
        value?: string;
    }
}
export interface ResourceGroupDeleteResponse {
    /**
     * Identifier
     */
    id: string;
}
/**
 * A group of scoped resources.
 */
export interface ResourceGroupGetResponse {
    /**
     * Identifier of the resource group.
     */
    id: string;
    /**
     * The scope associated to the resource group
     */
    scope: Array<ResourceGroupGetResponse.Scope>;
    /**
     * Attributes associated to the resource group.
     */
    meta?: ResourceGroupGetResponse.Meta;
    /**
     * Name of the resource group.
     */
    name?: string;
}
export declare namespace ResourceGroupGetResponse {
    /**
     * A scope is a combination of scope objects which provides additional context.
     */
    interface Scope {
        /**
         * This is a combination of pre-defined resource name and identifier (like Account
         * ID etc.)
         */
        key: string;
        /**
         * A list of scope objects for additional context.
         */
        objects: Array<Scope.Object>;
    }
    namespace Scope {
        /**
         * A scope object represents any resource that can have actions applied against
         * invite.
         */
        interface Object {
            /**
             * This is a combination of pre-defined resource name and identifier (like Zone ID
             * etc.)
             */
            key: string;
        }
    }
    /**
     * Attributes associated to the resource group.
     */
    interface Meta {
        key?: string;
        value?: string;
    }
}
export interface ResourceGroupCreateParams {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;
    /**
     * Body param: Name of the resource group
     */
    name: string;
    /**
     * Body param: A scope is a combination of scope objects which provides additional
     * context.
     */
    scope: ResourceGroupCreateParams.Scope;
}
export declare namespace ResourceGroupCreateParams {
    /**
     * A scope is a combination of scope objects which provides additional context.
     */
    interface Scope {
        /**
         * This is a combination of pre-defined resource name and identifier (like Account
         * ID etc.)
         */
        key: string;
        /**
         * A list of scope objects for additional context. The number of Scope objects
         * should not be zero.
         */
        objects: Array<Scope.Object>;
    }
    namespace Scope {
        /**
         * A scope object represents any resource that can have actions applied against
         * invite.
         */
        interface Object {
            /**
             * This is a combination of pre-defined resource name and identifier (like Zone ID
             * etc.)
             */
            key: string;
        }
    }
}
export interface ResourceGroupUpdateParams {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;
    /**
     * Body param: Name of the resource group
     */
    name?: string;
    /**
     * Body param: A scope is a combination of scope objects which provides additional
     * context.
     */
    scope?: ResourceGroupUpdateParams.Scope;
}
export declare namespace ResourceGroupUpdateParams {
    /**
     * A scope is a combination of scope objects which provides additional context.
     */
    interface Scope {
        /**
         * This is a combination of pre-defined resource name and identifier (like Account
         * ID etc.)
         */
        key: string;
        /**
         * A list of scope objects for additional context. The number of Scope objects
         * should not be zero.
         */
        objects: Array<Scope.Object>;
    }
    namespace Scope {
        /**
         * A scope object represents any resource that can have actions applied against
         * invite.
         */
        interface Object {
            /**
             * This is a combination of pre-defined resource name and identifier (like Zone ID
             * etc.)
             */
            key: string;
        }
    }
}
export interface ResourceGroupListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;
    /**
     * Query param: ID of the resource group to be fetched.
     */
    id?: string;
    /**
     * Query param: Name of the resource group to be fetched.
     */
    name?: string;
}
export interface ResourceGroupDeleteParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export interface ResourceGroupGetParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export declare namespace ResourceGroups {
    export { type ResourceGroupCreateResponse as ResourceGroupCreateResponse, type ResourceGroupUpdateResponse as ResourceGroupUpdateResponse, type ResourceGroupListResponse as ResourceGroupListResponse, type ResourceGroupDeleteResponse as ResourceGroupDeleteResponse, type ResourceGroupGetResponse as ResourceGroupGetResponse, ResourceGroupListResponsesV4PagePaginationArray as ResourceGroupListResponsesV4PagePaginationArray, type ResourceGroupCreateParams as ResourceGroupCreateParams, type ResourceGroupUpdateParams as ResourceGroupUpdateParams, type ResourceGroupListParams as ResourceGroupListParams, type ResourceGroupDeleteParams as ResourceGroupDeleteParams, type ResourceGroupGetParams as ResourceGroupGetParams, };
}
//# sourceMappingURL=resource-groups.d.ts.map