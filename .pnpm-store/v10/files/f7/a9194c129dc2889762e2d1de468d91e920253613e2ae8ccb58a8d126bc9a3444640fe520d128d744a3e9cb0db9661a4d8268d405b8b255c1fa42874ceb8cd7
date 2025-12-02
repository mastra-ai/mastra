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
exports.TokensV4PagePaginationArray = exports.Tokens = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
const shared_1 = require("../../shared.js");
Object.defineProperty(exports, "TokensV4PagePaginationArray", { enumerable: true, get: function () { return shared_1.TokensV4PagePaginationArray; } });
const PermissionGroupsAPI = __importStar(require("./permission-groups.js"));
const permission_groups_1 = require("./permission-groups.js");
const ValueAPI = __importStar(require("./value.js"));
const value_1 = require("./value.js");
class Tokens extends resource_1.APIResource {
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
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/user/tokens', shared_1.TokensV4PagePaginationArray, { query, ...options });
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
exports.Tokens = Tokens;
Tokens.PermissionGroups = permission_groups_1.PermissionGroups;
Tokens.PermissionGroupListResponsesSinglePage = permission_groups_1.PermissionGroupListResponsesSinglePage;
Tokens.Value = value_1.Value;
//# sourceMappingURL=tokens.js.map