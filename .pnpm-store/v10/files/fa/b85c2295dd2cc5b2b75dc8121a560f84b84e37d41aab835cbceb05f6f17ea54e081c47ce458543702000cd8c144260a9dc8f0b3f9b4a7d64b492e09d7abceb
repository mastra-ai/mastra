import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class ServiceTokens extends APIResource {
    /**
     * Generates a new service token. **Note:** This is the only time you can get the
     * Client Secret. If you lose the Client Secret, you will have to rotate the Client
     * Secret or create a new service token.
     *
     * @example
     * ```ts
     * const serviceToken =
     *   await client.zeroTrust.access.serviceTokens.create({
     *     name: 'CI/CD token',
     *     account_id: 'account_id',
     *   });
     * ```
     */
    create(params: ServiceTokenCreateParams, options?: Core.RequestOptions): Core.APIPromise<ServiceTokenCreateResponse>;
    /**
     * Updates a configured service token.
     *
     * @example
     * ```ts
     * const serviceToken =
     *   await client.zeroTrust.access.serviceTokens.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    update(serviceTokenId: string, params: ServiceTokenUpdateParams, options?: Core.RequestOptions): Core.APIPromise<ServiceToken>;
    /**
     * Lists all service tokens.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const serviceToken of client.zeroTrust.access.serviceTokens.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params?: ServiceTokenListParams, options?: Core.RequestOptions): Core.PagePromise<ServiceTokensSinglePage, ServiceToken>;
    list(options?: Core.RequestOptions): Core.PagePromise<ServiceTokensSinglePage, ServiceToken>;
    /**
     * Deletes a service token.
     *
     * @example
     * ```ts
     * const serviceToken =
     *   await client.zeroTrust.access.serviceTokens.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(serviceTokenId: string, params?: ServiceTokenDeleteParams, options?: Core.RequestOptions): Core.APIPromise<ServiceToken>;
    delete(serviceTokenId: string, options?: Core.RequestOptions): Core.APIPromise<ServiceToken>;
    /**
     * Fetches a single service token.
     *
     * @example
     * ```ts
     * const serviceToken =
     *   await client.zeroTrust.access.serviceTokens.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(serviceTokenId: string, params?: ServiceTokenGetParams, options?: Core.RequestOptions): Core.APIPromise<ServiceToken>;
    get(serviceTokenId: string, options?: Core.RequestOptions): Core.APIPromise<ServiceToken>;
    /**
     * Refreshes the expiration of a service token.
     *
     * @example
     * ```ts
     * const serviceToken =
     *   await client.zeroTrust.access.serviceTokens.refresh(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    refresh(serviceTokenId: string, params: ServiceTokenRefreshParams, options?: Core.RequestOptions): Core.APIPromise<ServiceToken>;
    /**
     * Generates a new Client Secret for a service token and revokes the old one.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.access.serviceTokens.rotate(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    rotate(serviceTokenId: string, params: ServiceTokenRotateParams, options?: Core.RequestOptions): Core.APIPromise<ServiceTokenRotateResponse>;
}
export declare class ServiceTokensSinglePage extends SinglePage<ServiceToken> {
}
export interface ServiceToken {
    /**
     * The ID of the service token.
     */
    id?: string;
    /**
     * The Client ID for the service token. Access will check for this value in the
     * `CF-Access-Client-ID` request header.
     */
    client_id?: string;
    created_at?: string;
    /**
     * The duration for how long the service token will be valid. Must be in the format
     * `300ms` or `2h45m`. Valid time units are: ns, us (or µs), ms, s, m, h. The
     * default is 1 year in hours (8760h).
     */
    duration?: string;
    expires_at?: string;
    last_seen_at?: string;
    /**
     * The name of the service token.
     */
    name?: string;
    updated_at?: string;
}
export interface ServiceTokenCreateResponse {
    /**
     * The ID of the service token.
     */
    id?: string;
    /**
     * The Client ID for the service token. Access will check for this value in the
     * `CF-Access-Client-ID` request header.
     */
    client_id?: string;
    /**
     * The Client Secret for the service token. Access will check for this value in the
     * `CF-Access-Client-Secret` request header.
     */
    client_secret?: string;
    created_at?: string;
    /**
     * The duration for how long the service token will be valid. Must be in the format
     * `300ms` or `2h45m`. Valid time units are: ns, us (or µs), ms, s, m, h. The
     * default is 1 year in hours (8760h).
     */
    duration?: string;
    /**
     * The name of the service token.
     */
    name?: string;
    updated_at?: string;
}
export interface ServiceTokenRotateResponse {
    /**
     * The ID of the service token.
     */
    id?: string;
    /**
     * The Client ID for the service token. Access will check for this value in the
     * `CF-Access-Client-ID` request header.
     */
    client_id?: string;
    /**
     * The Client Secret for the service token. Access will check for this value in the
     * `CF-Access-Client-Secret` request header.
     */
    client_secret?: string;
    created_at?: string;
    /**
     * The duration for how long the service token will be valid. Must be in the format
     * `300ms` or `2h45m`. Valid time units are: ns, us (or µs), ms, s, m, h. The
     * default is 1 year in hours (8760h).
     */
    duration?: string;
    /**
     * The name of the service token.
     */
    name?: string;
    updated_at?: string;
}
export interface ServiceTokenCreateParams {
    /**
     * Body param: The name of the service token.
     */
    name: string;
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
    /**
     * Body param: The duration for how long the service token will be valid. Must be
     * in the format `300ms` or `2h45m`. Valid time units are: ns, us (or µs), ms, s,
     * m, h. The default is 1 year in hours (8760h).
     */
    duration?: string;
}
export interface ServiceTokenUpdateParams {
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
    /**
     * Body param: The duration for how long the service token will be valid. Must be
     * in the format `300ms` or `2h45m`. Valid time units are: ns, us (or µs), ms, s,
     * m, h. The default is 1 year in hours (8760h).
     */
    duration?: string;
    /**
     * Body param: The name of the service token.
     */
    name?: string;
}
export interface ServiceTokenListParams {
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
    /**
     * Query param: The name of the service token.
     */
    name?: string;
    /**
     * Query param: Search for service tokens by other listed query parameters.
     */
    search?: string;
}
export interface ServiceTokenDeleteParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export interface ServiceTokenGetParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export interface ServiceTokenRefreshParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface ServiceTokenRotateParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace ServiceTokens {
    export { type ServiceToken as ServiceToken, type ServiceTokenCreateResponse as ServiceTokenCreateResponse, type ServiceTokenRotateResponse as ServiceTokenRotateResponse, ServiceTokensSinglePage as ServiceTokensSinglePage, type ServiceTokenCreateParams as ServiceTokenCreateParams, type ServiceTokenUpdateParams as ServiceTokenUpdateParams, type ServiceTokenListParams as ServiceTokenListParams, type ServiceTokenDeleteParams as ServiceTokenDeleteParams, type ServiceTokenGetParams as ServiceTokenGetParams, type ServiceTokenRefreshParams as ServiceTokenRefreshParams, type ServiceTokenRotateParams as ServiceTokenRotateParams, };
}
//# sourceMappingURL=service-tokens.d.ts.map