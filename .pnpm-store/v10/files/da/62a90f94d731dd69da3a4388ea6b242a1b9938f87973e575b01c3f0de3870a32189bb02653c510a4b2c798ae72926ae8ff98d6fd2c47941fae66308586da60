import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as Shared from "../../shared.js";
import { TokensV4PagePaginationArray } from "../../shared.js";
import * as PermissionGroupsAPI from "./permission-groups.js";
import { PermissionGroupGetParams, PermissionGroupGetResponse, PermissionGroupListParams, PermissionGroupListResponse, PermissionGroupListResponsesSinglePage, PermissionGroups } from "./permission-groups.js";
import * as ValueAPI from "./value.js";
import { Value, ValueUpdateParams } from "./value.js";
import { type V4PagePaginationArrayParams } from "../../../pagination.js";
export declare class Tokens extends APIResource {
    permissionGroups: PermissionGroupsAPI.PermissionGroups;
    value: ValueAPI.Value;
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
    create(params: TokenCreateParams, options?: Core.RequestOptions): Core.APIPromise<TokenCreateResponse>;
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
    update(tokenId: string, params: TokenUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Shared.Token>;
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
    list(params: TokenListParams, options?: Core.RequestOptions): Core.PagePromise<TokensV4PagePaginationArray, Shared.Token>;
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
    delete(tokenId: string, params: TokenDeleteParams, options?: Core.RequestOptions): Core.APIPromise<TokenDeleteResponse | null>;
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
    get(tokenId: string, params: TokenGetParams, options?: Core.RequestOptions): Core.APIPromise<Shared.Token>;
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
    verify(params: TokenVerifyParams, options?: Core.RequestOptions): Core.APIPromise<TokenVerifyResponse>;
}
export interface TokenCreateResponse {
    /**
     * Token identifier tag.
     */
    id?: string;
    condition?: TokenCreateResponse.Condition;
    /**
     * The expiration time on or after which the JWT MUST NOT be accepted for
     * processing.
     */
    expires_on?: string;
    /**
     * The time on which the token was created.
     */
    issued_on?: string;
    /**
     * Last time the token was used.
     */
    last_used_on?: string;
    /**
     * Last time the token was modified.
     */
    modified_on?: string;
    /**
     * Token name.
     */
    name?: string;
    /**
     * The time before which the token MUST NOT be accepted for processing.
     */
    not_before?: string;
    /**
     * List of access policies assigned to the token.
     */
    policies?: Array<Shared.TokenPolicy>;
    /**
     * Status of the token.
     */
    status?: 'active' | 'disabled' | 'expired';
    /**
     * The token value.
     */
    value?: Shared.TokenValue;
}
export declare namespace TokenCreateResponse {
    interface Condition {
        /**
         * Client IP restrictions.
         */
        request_ip?: Condition.RequestIP;
    }
    namespace Condition {
        /**
         * Client IP restrictions.
         */
        interface RequestIP {
            /**
             * List of IPv4/IPv6 CIDR addresses.
             */
            in?: Array<Shared.TokenConditionCIDRList>;
            /**
             * List of IPv4/IPv6 CIDR addresses.
             */
            not_in?: Array<Shared.TokenConditionCIDRList>;
        }
    }
}
export interface TokenDeleteResponse {
    /**
     * Identifier
     */
    id: string;
}
export interface TokenVerifyResponse {
    /**
     * Token identifier tag.
     */
    id: string;
    /**
     * Status of the token.
     */
    status: 'active' | 'disabled' | 'expired';
    /**
     * The expiration time on or after which the JWT MUST NOT be accepted for
     * processing.
     */
    expires_on?: string;
    /**
     * The time before which the token MUST NOT be accepted for processing.
     */
    not_before?: string;
}
export interface TokenCreateParams {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;
    /**
     * Body param: Token name.
     */
    name: string;
    /**
     * Body param: List of access policies assigned to the token.
     */
    policies: Array<Shared.TokenPolicyParam>;
    /**
     * Body param:
     */
    condition?: TokenCreateParams.Condition;
    /**
     * Body param: The expiration time on or after which the JWT MUST NOT be accepted
     * for processing.
     */
    expires_on?: string;
    /**
     * Body param: The time before which the token MUST NOT be accepted for processing.
     */
    not_before?: string;
}
export declare namespace TokenCreateParams {
    interface Condition {
        /**
         * Client IP restrictions.
         */
        request_ip?: Condition.RequestIP;
    }
    namespace Condition {
        /**
         * Client IP restrictions.
         */
        interface RequestIP {
            /**
             * List of IPv4/IPv6 CIDR addresses.
             */
            in?: Array<Shared.TokenConditionCIDRListParam>;
            /**
             * List of IPv4/IPv6 CIDR addresses.
             */
            not_in?: Array<Shared.TokenConditionCIDRListParam>;
        }
    }
}
export interface TokenUpdateParams {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;
    /**
     * Body param: Token name.
     */
    name: string;
    /**
     * Body param: List of access policies assigned to the token.
     */
    policies: Array<Shared.TokenPolicyParam>;
    /**
     * Body param:
     */
    condition?: TokenUpdateParams.Condition;
    /**
     * Body param: The expiration time on or after which the JWT MUST NOT be accepted
     * for processing.
     */
    expires_on?: string;
    /**
     * Body param: The time before which the token MUST NOT be accepted for processing.
     */
    not_before?: string;
    /**
     * Body param: Status of the token.
     */
    status?: 'active' | 'disabled' | 'expired';
}
export declare namespace TokenUpdateParams {
    interface Condition {
        /**
         * Client IP restrictions.
         */
        request_ip?: Condition.RequestIP;
    }
    namespace Condition {
        /**
         * Client IP restrictions.
         */
        interface RequestIP {
            /**
             * List of IPv4/IPv6 CIDR addresses.
             */
            in?: Array<Shared.TokenConditionCIDRListParam>;
            /**
             * List of IPv4/IPv6 CIDR addresses.
             */
            not_in?: Array<Shared.TokenConditionCIDRListParam>;
        }
    }
}
export interface TokenListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;
    /**
     * Query param: Direction to order results.
     */
    direction?: 'asc' | 'desc';
}
export interface TokenDeleteParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export interface TokenGetParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export interface TokenVerifyParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export declare namespace Tokens {
    export { type TokenCreateResponse as TokenCreateResponse, type TokenDeleteResponse as TokenDeleteResponse, type TokenVerifyResponse as TokenVerifyResponse, type TokenCreateParams as TokenCreateParams, type TokenUpdateParams as TokenUpdateParams, type TokenListParams as TokenListParams, type TokenDeleteParams as TokenDeleteParams, type TokenGetParams as TokenGetParams, type TokenVerifyParams as TokenVerifyParams, };
    export { PermissionGroups as PermissionGroups, type PermissionGroupListResponse as PermissionGroupListResponse, type PermissionGroupGetResponse as PermissionGroupGetResponse, PermissionGroupListResponsesSinglePage as PermissionGroupListResponsesSinglePage, type PermissionGroupListParams as PermissionGroupListParams, type PermissionGroupGetParams as PermissionGroupGetParams, };
    export { Value as Value, type ValueUpdateParams as ValueUpdateParams };
}
export { TokensV4PagePaginationArray };
//# sourceMappingURL=tokens.d.ts.map