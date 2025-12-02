// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
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
     * Create a new access token.
     *
     * @example
     * ```ts
     * const token = await client.user.tokens.create({
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
    create(body, options) {
        return this._client.post('/user/tokens', { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update an existing token.
     *
     * @example
     * ```ts
     * const token = await client.user.tokens.update(
     *   'ed17574386854bf78a67040be0a770b0',
     *   {
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
    update(tokenId, body, options) {
        return this._client.put(`/user/tokens/${tokenId}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    list(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/user/tokens', TokensV4PagePaginationArray, { query, ...options });
    }
    /**
     * Destroy a token.
     *
     * @example
     * ```ts
     * const token = await client.user.tokens.delete(
     *   'ed17574386854bf78a67040be0a770b0',
     * );
     * ```
     */
    delete(tokenId, options) {
        return this._client.delete(`/user/tokens/${tokenId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get information about a specific token.
     *
     * @example
     * ```ts
     * const token = await client.user.tokens.get(
     *   'ed17574386854bf78a67040be0a770b0',
     * );
     * ```
     */
    get(tokenId, options) {
        return this._client.get(`/user/tokens/${tokenId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Test whether a token works.
     *
     * @example
     * ```ts
     * const response = await client.user.tokens.verify();
     * ```
     */
    verify(options) {
        return this._client.get('/user/tokens/verify', options)._thenUnwrap((obj) => obj.result);
    }
}
Tokens.PermissionGroups = PermissionGroups;
Tokens.PermissionGroupListResponsesSinglePage = PermissionGroupListResponsesSinglePage;
Tokens.Value = Value;
export { TokensV4PagePaginationArray };
//# sourceMappingURL=tokens.mjs.map