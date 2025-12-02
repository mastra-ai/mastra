import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class ProxyEndpoints extends APIResource {
    /**
     * Creates a new Zero Trust Gateway proxy endpoint.
     *
     * @example
     * ```ts
     * const proxyEndpoint =
     *   await client.zeroTrust.gateway.proxyEndpoints.create({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     ips: ['192.0.2.1/32'],
     *     name: 'Devops team',
     *   });
     * ```
     */
    create(params: ProxyEndpointCreateParams, options?: Core.RequestOptions): Core.APIPromise<ProxyEndpoint>;
    /**
     * Fetches all Zero Trust Gateway proxy endpoints for an account.
     *
     * @example
     * ```ts
     * const proxyEndpoint =
     *   await client.zeroTrust.gateway.proxyEndpoints.list({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    list(params: ProxyEndpointListParams, options?: Core.RequestOptions): Core.APIPromise<ProxyEndpoint>;
    /**
     * Deletes a configured Zero Trust Gateway proxy endpoint.
     *
     * @example
     * ```ts
     * const proxyEndpoint =
     *   await client.zeroTrust.gateway.proxyEndpoints.delete(
     *     'ed35569b41ce4d1facfe683550f54086',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    delete(proxyEndpointId: string, params: ProxyEndpointDeleteParams, options?: Core.RequestOptions): Core.APIPromise<ProxyEndpointDeleteResponse>;
    /**
     * Updates a configured Zero Trust Gateway proxy endpoint.
     *
     * @example
     * ```ts
     * const proxyEndpoint =
     *   await client.zeroTrust.gateway.proxyEndpoints.edit(
     *     'ed35569b41ce4d1facfe683550f54086',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    edit(proxyEndpointId: string, params: ProxyEndpointEditParams, options?: Core.RequestOptions): Core.APIPromise<ProxyEndpoint>;
    /**
     * Fetches a single Zero Trust Gateway proxy endpoint.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const proxyEndpoint of client.zeroTrust.gateway.proxyEndpoints.get(
     *   'ed35569b41ce4d1facfe683550f54086',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(proxyEndpointId: string, params: ProxyEndpointGetParams, options?: Core.RequestOptions): Core.PagePromise<ProxyEndpointsSinglePage, ProxyEndpoint>;
}
export declare class ProxyEndpointsSinglePage extends SinglePage<ProxyEndpoint> {
}
/**
 * The IPv4 CIDR or IPv6 CIDR. IPv6 CIDRs are limited to a maximum of /109. IPv4
 * CIDRs are limited to a maximum of /25.
 */
export type GatewayIPs = string;
/**
 * The IPv4 CIDR or IPv6 CIDR. IPv6 CIDRs are limited to a maximum of /109. IPv4
 * CIDRs are limited to a maximum of /25.
 */
export type GatewayIPsParam = string;
export interface ProxyEndpoint {
    id?: string;
    created_at?: string;
    /**
     * A list of CIDRs to restrict ingress connections.
     */
    ips?: Array<GatewayIPs>;
    /**
     * The name of the proxy endpoint.
     */
    name?: string;
    /**
     * The subdomain to be used as the destination in the proxy client.
     */
    subdomain?: string;
    updated_at?: string;
}
export type ProxyEndpointDeleteResponse = unknown;
export interface ProxyEndpointCreateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: A list of CIDRs to restrict ingress connections.
     */
    ips: Array<GatewayIPsParam>;
    /**
     * Body param: The name of the proxy endpoint.
     */
    name: string;
}
export interface ProxyEndpointListParams {
    account_id: string;
}
export interface ProxyEndpointDeleteParams {
    account_id: string;
}
export interface ProxyEndpointEditParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: A list of CIDRs to restrict ingress connections.
     */
    ips?: Array<GatewayIPsParam>;
    /**
     * Body param: The name of the proxy endpoint.
     */
    name?: string;
}
export interface ProxyEndpointGetParams {
    account_id: string;
}
export declare namespace ProxyEndpoints {
    export { type GatewayIPs as GatewayIPs, type ProxyEndpoint as ProxyEndpoint, type ProxyEndpointDeleteResponse as ProxyEndpointDeleteResponse, ProxyEndpointsSinglePage as ProxyEndpointsSinglePage, type ProxyEndpointCreateParams as ProxyEndpointCreateParams, type ProxyEndpointListParams as ProxyEndpointListParams, type ProxyEndpointDeleteParams as ProxyEndpointDeleteParams, type ProxyEndpointEditParams as ProxyEndpointEditParams, type ProxyEndpointGetParams as ProxyEndpointGetParams, };
}
//# sourceMappingURL=proxy-endpoints.d.ts.map