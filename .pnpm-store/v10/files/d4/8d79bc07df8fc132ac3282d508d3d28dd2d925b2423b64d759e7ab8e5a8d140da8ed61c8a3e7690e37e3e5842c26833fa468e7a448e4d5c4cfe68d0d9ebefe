import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as ReverseDNSAPI from "./reverse-dns.js";
import { ReverseDNS, ReverseDNSEditParams, ReverseDNSEditResponse, ReverseDNSGetParams, ReverseDNSGetResponse } from "./reverse-dns.js";
import * as AnalyticsAPI from "./analytics/analytics.js";
import { Analytics } from "./analytics/analytics.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class DNSFirewall extends APIResource {
    analytics: AnalyticsAPI.Analytics;
    reverseDNS: ReverseDNSAPI.ReverseDNS;
    /**
     * Create a DNS Firewall cluster
     *
     * @example
     * ```ts
     * const dnsFirewall = await client.dnsFirewall.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'My Awesome DNS Firewall cluster',
     *   upstream_ips: [
     *     '192.0.2.1',
     *     '198.51.100.1',
     *     '2001:DB8:100::CF',
     *   ],
     * });
     * ```
     */
    create(params: DNSFirewallCreateParams, options?: Core.RequestOptions): Core.APIPromise<DNSFirewallCreateResponse>;
    /**
     * List DNS Firewall clusters for an account
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const dnsFirewallListResponse of client.dnsFirewall.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: DNSFirewallListParams, options?: Core.RequestOptions): Core.PagePromise<DNSFirewallListResponsesV4PagePaginationArray, DNSFirewallListResponse>;
    /**
     * Delete a DNS Firewall cluster
     *
     * @example
     * ```ts
     * const dnsFirewall = await client.dnsFirewall.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(dnsFirewallId: string, params: DNSFirewallDeleteParams, options?: Core.RequestOptions): Core.APIPromise<DNSFirewallDeleteResponse>;
    /**
     * Modify the configuration of a DNS Firewall cluster
     *
     * @example
     * ```ts
     * const response = await client.dnsFirewall.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(dnsFirewallId: string, params: DNSFirewallEditParams, options?: Core.RequestOptions): Core.APIPromise<DNSFirewallEditResponse>;
    /**
     * Show a single DNS Firewall cluster for an account
     *
     * @example
     * ```ts
     * const dnsFirewall = await client.dnsFirewall.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(dnsFirewallId: string, params: DNSFirewallGetParams, options?: Core.RequestOptions): Core.APIPromise<DNSFirewallGetResponse>;
}
export declare class DNSFirewallListResponsesV4PagePaginationArray extends V4PagePaginationArray<DNSFirewallListResponse> {
}
/**
 * Attack mitigation settings
 */
export interface AttackMitigation {
    /**
     * When enabled, automatically mitigate random-prefix attacks to protect upstream
     * DNS servers
     */
    enabled?: boolean;
    /**
     * Only mitigate attacks when upstream servers seem unhealthy
     */
    only_when_upstream_unhealthy?: boolean;
}
/**
 * Attack mitigation settings
 */
export interface AttackMitigationParam {
    /**
     * When enabled, automatically mitigate random-prefix attacks to protect upstream
     * DNS servers
     */
    enabled?: boolean;
    /**
     * Only mitigate attacks when upstream servers seem unhealthy
     */
    only_when_upstream_unhealthy?: boolean;
}
/**
 * Cloudflare-assigned DNS IPv4 address
 */
export type FirewallIPs = string;
/**
 * Upstream DNS Server IPv4 address
 */
export type UpstreamIPs = string;
/**
 * Upstream DNS Server IPv4 address
 */
export type UpstreamIPsParam = string;
export interface DNSFirewallCreateResponse {
    /**
     * Identifier.
     */
    id: string;
    /**
     * Whether to refuse to answer queries for the ANY type
     */
    deprecate_any_requests: boolean;
    dns_firewall_ips: Array<FirewallIPs>;
    /**
     * Whether to forward client IP (resolver) subnet if no EDNS Client Subnet is sent
     */
    ecs_fallback: boolean;
    /**
     * Maximum DNS cache TTL This setting sets an upper bound on DNS TTLs for purposes
     * of caching between DNS Firewall and the upstream servers. Higher TTLs will be
     * decreased to the maximum defined here for caching purposes.
     */
    maximum_cache_ttl: number;
    /**
     * Minimum DNS cache TTL This setting sets a lower bound on DNS TTLs for purposes
     * of caching between DNS Firewall and the upstream servers. Lower TTLs will be
     * increased to the minimum defined here for caching purposes.
     */
    minimum_cache_ttl: number;
    /**
     * Last modification of DNS Firewall cluster
     */
    modified_on: string;
    /**
     * DNS Firewall cluster name
     */
    name: string;
    /**
     * Negative DNS cache TTL This setting controls how long DNS Firewall should cache
     * negative responses (e.g., NXDOMAIN) from the upstream servers.
     */
    negative_cache_ttl: number | null;
    /**
     * Ratelimit in queries per second per datacenter (applies to DNS queries sent to
     * the upstream nameservers configured on the cluster)
     */
    ratelimit: number | null;
    /**
     * Number of retries for fetching DNS responses from upstream nameservers (not
     * counting the initial attempt)
     */
    retries: number;
    upstream_ips: Array<UpstreamIPs>;
    /**
     * Attack mitigation settings
     */
    attack_mitigation?: AttackMitigation | null;
}
export interface DNSFirewallListResponse {
    /**
     * Identifier.
     */
    id: string;
    /**
     * Whether to refuse to answer queries for the ANY type
     */
    deprecate_any_requests: boolean;
    dns_firewall_ips: Array<FirewallIPs>;
    /**
     * Whether to forward client IP (resolver) subnet if no EDNS Client Subnet is sent
     */
    ecs_fallback: boolean;
    /**
     * Maximum DNS cache TTL This setting sets an upper bound on DNS TTLs for purposes
     * of caching between DNS Firewall and the upstream servers. Higher TTLs will be
     * decreased to the maximum defined here for caching purposes.
     */
    maximum_cache_ttl: number;
    /**
     * Minimum DNS cache TTL This setting sets a lower bound on DNS TTLs for purposes
     * of caching between DNS Firewall and the upstream servers. Lower TTLs will be
     * increased to the minimum defined here for caching purposes.
     */
    minimum_cache_ttl: number;
    /**
     * Last modification of DNS Firewall cluster
     */
    modified_on: string;
    /**
     * DNS Firewall cluster name
     */
    name: string;
    /**
     * Negative DNS cache TTL This setting controls how long DNS Firewall should cache
     * negative responses (e.g., NXDOMAIN) from the upstream servers.
     */
    negative_cache_ttl: number | null;
    /**
     * Ratelimit in queries per second per datacenter (applies to DNS queries sent to
     * the upstream nameservers configured on the cluster)
     */
    ratelimit: number | null;
    /**
     * Number of retries for fetching DNS responses from upstream nameservers (not
     * counting the initial attempt)
     */
    retries: number;
    upstream_ips: Array<UpstreamIPs>;
    /**
     * Attack mitigation settings
     */
    attack_mitigation?: AttackMitigation | null;
}
export interface DNSFirewallDeleteResponse {
    /**
     * Identifier.
     */
    id?: string;
}
export interface DNSFirewallEditResponse {
    /**
     * Identifier.
     */
    id: string;
    /**
     * Whether to refuse to answer queries for the ANY type
     */
    deprecate_any_requests: boolean;
    dns_firewall_ips: Array<FirewallIPs>;
    /**
     * Whether to forward client IP (resolver) subnet if no EDNS Client Subnet is sent
     */
    ecs_fallback: boolean;
    /**
     * Maximum DNS cache TTL This setting sets an upper bound on DNS TTLs for purposes
     * of caching between DNS Firewall and the upstream servers. Higher TTLs will be
     * decreased to the maximum defined here for caching purposes.
     */
    maximum_cache_ttl: number;
    /**
     * Minimum DNS cache TTL This setting sets a lower bound on DNS TTLs for purposes
     * of caching between DNS Firewall and the upstream servers. Lower TTLs will be
     * increased to the minimum defined here for caching purposes.
     */
    minimum_cache_ttl: number;
    /**
     * Last modification of DNS Firewall cluster
     */
    modified_on: string;
    /**
     * DNS Firewall cluster name
     */
    name: string;
    /**
     * Negative DNS cache TTL This setting controls how long DNS Firewall should cache
     * negative responses (e.g., NXDOMAIN) from the upstream servers.
     */
    negative_cache_ttl: number | null;
    /**
     * Ratelimit in queries per second per datacenter (applies to DNS queries sent to
     * the upstream nameservers configured on the cluster)
     */
    ratelimit: number | null;
    /**
     * Number of retries for fetching DNS responses from upstream nameservers (not
     * counting the initial attempt)
     */
    retries: number;
    upstream_ips: Array<UpstreamIPs>;
    /**
     * Attack mitigation settings
     */
    attack_mitigation?: AttackMitigation | null;
}
export interface DNSFirewallGetResponse {
    /**
     * Identifier.
     */
    id: string;
    /**
     * Whether to refuse to answer queries for the ANY type
     */
    deprecate_any_requests: boolean;
    dns_firewall_ips: Array<FirewallIPs>;
    /**
     * Whether to forward client IP (resolver) subnet if no EDNS Client Subnet is sent
     */
    ecs_fallback: boolean;
    /**
     * Maximum DNS cache TTL This setting sets an upper bound on DNS TTLs for purposes
     * of caching between DNS Firewall and the upstream servers. Higher TTLs will be
     * decreased to the maximum defined here for caching purposes.
     */
    maximum_cache_ttl: number;
    /**
     * Minimum DNS cache TTL This setting sets a lower bound on DNS TTLs for purposes
     * of caching between DNS Firewall and the upstream servers. Lower TTLs will be
     * increased to the minimum defined here for caching purposes.
     */
    minimum_cache_ttl: number;
    /**
     * Last modification of DNS Firewall cluster
     */
    modified_on: string;
    /**
     * DNS Firewall cluster name
     */
    name: string;
    /**
     * Negative DNS cache TTL This setting controls how long DNS Firewall should cache
     * negative responses (e.g., NXDOMAIN) from the upstream servers.
     */
    negative_cache_ttl: number | null;
    /**
     * Ratelimit in queries per second per datacenter (applies to DNS queries sent to
     * the upstream nameservers configured on the cluster)
     */
    ratelimit: number | null;
    /**
     * Number of retries for fetching DNS responses from upstream nameservers (not
     * counting the initial attempt)
     */
    retries: number;
    upstream_ips: Array<UpstreamIPs>;
    /**
     * Attack mitigation settings
     */
    attack_mitigation?: AttackMitigation | null;
}
export interface DNSFirewallCreateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: DNS Firewall cluster name
     */
    name: string;
    /**
     * Body param:
     */
    upstream_ips: Array<UpstreamIPsParam>;
    /**
     * Body param: Attack mitigation settings
     */
    attack_mitigation?: AttackMitigationParam | null;
    /**
     * Body param: Whether to refuse to answer queries for the ANY type
     */
    deprecate_any_requests?: boolean;
    /**
     * Body param: Whether to forward client IP (resolver) subnet if no EDNS Client
     * Subnet is sent
     */
    ecs_fallback?: boolean;
    /**
     * Body param: Maximum DNS cache TTL This setting sets an upper bound on DNS TTLs
     * for purposes of caching between DNS Firewall and the upstream servers. Higher
     * TTLs will be decreased to the maximum defined here for caching purposes.
     */
    maximum_cache_ttl?: number;
    /**
     * Body param: Minimum DNS cache TTL This setting sets a lower bound on DNS TTLs
     * for purposes of caching between DNS Firewall and the upstream servers. Lower
     * TTLs will be increased to the minimum defined here for caching purposes.
     */
    minimum_cache_ttl?: number;
    /**
     * Body param: Negative DNS cache TTL This setting controls how long DNS Firewall
     * should cache negative responses (e.g., NXDOMAIN) from the upstream servers.
     */
    negative_cache_ttl?: number | null;
    /**
     * Body param: Ratelimit in queries per second per datacenter (applies to DNS
     * queries sent to the upstream nameservers configured on the cluster)
     */
    ratelimit?: number | null;
    /**
     * Body param: Number of retries for fetching DNS responses from upstream
     * nameservers (not counting the initial attempt)
     */
    retries?: number;
}
export interface DNSFirewallListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
}
export interface DNSFirewallDeleteParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface DNSFirewallEditParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: Attack mitigation settings
     */
    attack_mitigation?: AttackMitigationParam | null;
    /**
     * Body param: Whether to refuse to answer queries for the ANY type
     */
    deprecate_any_requests?: boolean;
    /**
     * Body param: Whether to forward client IP (resolver) subnet if no EDNS Client
     * Subnet is sent
     */
    ecs_fallback?: boolean;
    /**
     * Body param: Maximum DNS cache TTL This setting sets an upper bound on DNS TTLs
     * for purposes of caching between DNS Firewall and the upstream servers. Higher
     * TTLs will be decreased to the maximum defined here for caching purposes.
     */
    maximum_cache_ttl?: number;
    /**
     * Body param: Minimum DNS cache TTL This setting sets a lower bound on DNS TTLs
     * for purposes of caching between DNS Firewall and the upstream servers. Lower
     * TTLs will be increased to the minimum defined here for caching purposes.
     */
    minimum_cache_ttl?: number;
    /**
     * Body param: DNS Firewall cluster name
     */
    name?: string;
    /**
     * Body param: Negative DNS cache TTL This setting controls how long DNS Firewall
     * should cache negative responses (e.g., NXDOMAIN) from the upstream servers.
     */
    negative_cache_ttl?: number | null;
    /**
     * Body param: Ratelimit in queries per second per datacenter (applies to DNS
     * queries sent to the upstream nameservers configured on the cluster)
     */
    ratelimit?: number | null;
    /**
     * Body param: Number of retries for fetching DNS responses from upstream
     * nameservers (not counting the initial attempt)
     */
    retries?: number;
    /**
     * Body param:
     */
    upstream_ips?: Array<UpstreamIPsParam>;
}
export interface DNSFirewallGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace DNSFirewall {
    export { type AttackMitigation as AttackMitigation, type FirewallIPs as FirewallIPs, type UpstreamIPs as UpstreamIPs, type DNSFirewallCreateResponse as DNSFirewallCreateResponse, type DNSFirewallListResponse as DNSFirewallListResponse, type DNSFirewallDeleteResponse as DNSFirewallDeleteResponse, type DNSFirewallEditResponse as DNSFirewallEditResponse, type DNSFirewallGetResponse as DNSFirewallGetResponse, DNSFirewallListResponsesV4PagePaginationArray as DNSFirewallListResponsesV4PagePaginationArray, type DNSFirewallCreateParams as DNSFirewallCreateParams, type DNSFirewallListParams as DNSFirewallListParams, type DNSFirewallDeleteParams as DNSFirewallDeleteParams, type DNSFirewallEditParams as DNSFirewallEditParams, type DNSFirewallGetParams as DNSFirewallGetParams, };
    export { Analytics as Analytics };
    export { ReverseDNS as ReverseDNS, type ReverseDNSEditResponse as ReverseDNSEditResponse, type ReverseDNSGetResponse as ReverseDNSGetResponse, type ReverseDNSEditParams as ReverseDNSEditParams, type ReverseDNSGetParams as ReverseDNSGetParams, };
}
//# sourceMappingURL=dns-firewall.d.ts.map