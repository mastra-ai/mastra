// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class ResourceGroups extends APIResource {
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
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/iam/resource_groups`, { body, ...options });
    }
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
    update(resourceGroupId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/iam/resource_groups/${resourceGroupId}`, {
            body,
            ...options,
        });
    }
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
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/iam/resource_groups`, ResourceGroupListResponsesV4PagePaginationArray, { query, ...options });
    }
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
    delete(resourceGroupId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/iam/resource_groups/${resourceGroupId}`, options)._thenUnwrap((obj) => obj.result);
    }
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
    get(resourceGroupId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/iam/resource_groups/${resourceGroupId}`, options);
    }
}
export class ResourceGroupListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
ResourceGroups.ResourceGroupListResponsesV4PagePaginationArray =
    ResourceGroupListResponsesV4PagePaginationArray;
//# sourceMappingURL=resource-groups.mjs.map