// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { TokensV4PagePaginationArray } from "../../shared.mjs";
import * as PermissionGroupsAPI from "./permission-groups.mjs";
import { PermissionGroupListResponsesSinglePage, PermissionGroups, } from "./permission-groups.mjs";
import * as ValueAPI from "./value.mjs";
import { Value } from "./value.mjs";
export class Tokens extends APIResource {
    constructor() {
        super(...arguments);
        this.permissionGroups = new PermissionGroupsAPI.PermissionGroups(this._client);
        this.value = new ValueAPI.Value(this._client);
    }
    /**
     * Create a new Account Owned API token.
     *
     * @example
     * ```ts
     * const token = await client.accounts.tokens.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'readonly token',
     *   policies: [
     *     {
     *       effect: 'allow',
     *       permission_groups: [
     *         { id: 'c8fed203ed3043cba015a93ad1616f1f' },
     *         { id: '82e64a83756745bbbb1c9c2701bf816b' },
     *       ],
     *       resources: { foo: 'string' },
     *     },
     *   ],
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/tokens`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update an existing token.
     *
     * @example
     * ```ts
     * const token = await client.accounts.tokens.update(
     *   'ed17574386854bf78a67040be0a770b0',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     name: 'readonly token',
     *     policies: [
     *       {
     *         effect: 'allow',
     *         permission_groups: [
     *           { id: 'c8fed203ed3043cba015a93ad1616f1f' },
     *           { id: '82e64a83756745bbbb1c9c2701bf816b' },
     *         ],
     *         resources: { foo: 'string' },
     *       },
     *     ],
     *   },
     * );
     * ```
     */
    update(tokenId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/tokens/${tokenId}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List all Account Owned API tokens created for this account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const token of client.accounts.tokens.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/tokens`, TokensV4PagePaginationArray, {
            query,
            ...options,
        });
    }
    /**
     * Destroy an Account Owned API token.
     *
     * @example
     * ```ts
     * const token = await client.accounts.tokens.delete(
     *   'ed17574386854bf78a67040be0a770b0',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(tokenId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/tokens/${tokenId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get information about a specific Account Owned API token.
     *
     * @example
     * ```ts
     * const token = await client.accounts.tokens.get(
     *   'ed17574386854bf78a67040be0a770b0',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(tokenId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/tokens/${tokenId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Test whether a token works.
     *
     * @example
     * ```ts
     * const response = await client.accounts.tokens.verify({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    verify(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/tokens/verify`, options)._thenUnwrap((obj) => obj.result);
    }
}
Tokens.PermissionGroups = PermissionGroups;
Tokens.PermissionGroupListResponsesSinglePage = PermissionGroupListResponsesSinglePage;
Tokens.Value = Value;
export { TokensV4PagePaginationArray };
//# sourceMappingURL=tokens.mjs.map