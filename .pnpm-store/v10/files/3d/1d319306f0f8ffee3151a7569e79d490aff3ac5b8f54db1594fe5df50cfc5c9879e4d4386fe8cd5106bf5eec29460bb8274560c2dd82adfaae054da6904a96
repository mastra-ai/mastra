import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as PreviewsAPI from "./previews.js";
import { PreviewCreateParams, PreviewDeleteParams, PreviewDeleteResponse, PreviewGetParams, Previews } from "./previews.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class Healthchecks extends APIResource {
    previews: PreviewsAPI.Previews;
    /**
     * Create a new health check.
     *
     * @example
     * ```ts
     * const healthcheck = await client.healthchecks.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   address: 'www.example.com',
     *   name: 'server-1',
     * });
     * ```
     */
    create(params: HealthcheckCreateParams, options?: Core.RequestOptions): Core.APIPromise<Healthcheck>;
    /**
     * Update a configured health check.
     *
     * @example
     * ```ts
     * const healthcheck = await client.healthchecks.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     address: 'www.example.com',
     *     name: 'server-1',
     *   },
     * );
     * ```
     */
    update(healthcheckId: string, params: HealthcheckUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Healthcheck>;
    /**
     * List configured health checks.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const healthcheck of client.healthchecks.list({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params: HealthcheckListParams, options?: Core.RequestOptions): Core.PagePromise<HealthchecksV4PagePaginationArray, Healthcheck>;
    /**
     * Delete a health check.
     *
     * @example
     * ```ts
     * const healthcheck = await client.healthchecks.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(healthcheckId: string, params: HealthcheckDeleteParams, options?: Core.RequestOptions): Core.APIPromise<HealthcheckDeleteResponse>;
    /**
     * Patch a configured health check.
     *
     * @example
     * ```ts
     * const healthcheck = await client.healthchecks.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     address: 'www.example.com',
     *     name: 'server-1',
     *   },
     * );
     * ```
     */
    edit(healthcheckId: string, params: HealthcheckEditParams, options?: Core.RequestOptions): Core.APIPromise<Healthcheck>;
    /**
     * Fetch a single configured health check.
     *
     * @example
     * ```ts
     * const healthcheck = await client.healthchecks.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(healthcheckId: string, params: HealthcheckGetParams, options?: Core.RequestOptions): Core.APIPromise<Healthcheck>;
}
export declare class HealthchecksV4PagePaginationArray extends V4PagePaginationArray<Healthcheck> {
}
/**
 * WNAM: Western North America, ENAM: Eastern North America, WEU: Western Europe,
 * EEU: Eastern Europe, NSAM: Northern South America, SSAM: Southern South America,
 * OC: Oceania, ME: Middle East, NAF: North Africa, SAF: South Africa, IN: India,
 * SEAS: South East Asia, NEAS: North East Asia, ALL_REGIONS: all regions (BUSINESS
 * and ENTERPRISE customers only).
 */
export type CheckRegion = 'WNAM' | 'ENAM' | 'WEU' | 'EEU' | 'NSAM' | 'SSAM' | 'OC' | 'ME' | 'NAF' | 'SAF' | 'IN' | 'SEAS' | 'NEAS' | 'ALL_REGIONS';
/**
 * WNAM: Western North America, ENAM: Eastern North America, WEU: Western Europe,
 * EEU: Eastern Europe, NSAM: Northern South America, SSAM: Southern South America,
 * OC: Oceania, ME: Middle East, NAF: North Africa, SAF: South Africa, IN: India,
 * SEAS: South East Asia, NEAS: North East Asia, ALL_REGIONS: all regions (BUSINESS
 * and ENTERPRISE customers only).
 */
export type CheckRegionParam = 'WNAM' | 'ENAM' | 'WEU' | 'EEU' | 'NSAM' | 'SSAM' | 'OC' | 'ME' | 'NAF' | 'SAF' | 'IN' | 'SEAS' | 'NEAS' | 'ALL_REGIONS';
export interface Healthcheck {
    /**
     * Identifier
     */
    id?: string;
    /**
     * The hostname or IP address of the origin server to run health checks on.
     */
    address?: string;
    /**
     * A list of regions from which to run health checks. Null means Cloudflare will
     * pick a default region.
     */
    check_regions?: Array<CheckRegion> | null;
    /**
     * The number of consecutive fails required from a health check before changing the
     * health to unhealthy.
     */
    consecutive_fails?: number;
    /**
     * The number of consecutive successes required from a health check before changing
     * the health to healthy.
     */
    consecutive_successes?: number;
    created_on?: string;
    /**
     * A human-readable description of the health check.
     */
    description?: string;
    /**
     * The current failure reason if status is unhealthy.
     */
    failure_reason?: string;
    /**
     * Parameters specific to an HTTP or HTTPS health check.
     */
    http_config?: HTTPConfiguration | null;
    /**
     * The interval between each health check. Shorter intervals may give quicker
     * notifications if the origin status changes, but will increase load on the origin
     * as we check from multiple locations.
     */
    interval?: number;
    modified_on?: string;
    /**
     * A short name to identify the health check. Only alphanumeric characters, hyphens
     * and underscores are allowed.
     */
    name?: string;
    /**
     * The number of retries to attempt in case of a timeout before marking the origin
     * as unhealthy. Retries are attempted immediately.
     */
    retries?: number;
    /**
     * The current status of the origin server according to the health check.
     */
    status?: 'unknown' | 'healthy' | 'unhealthy' | 'suspended';
    /**
     * If suspended, no health checks are sent to the origin.
     */
    suspended?: boolean;
    /**
     * Parameters specific to TCP health check.
     */
    tcp_config?: TCPConfiguration | null;
    /**
     * The timeout (in seconds) before marking the health check as failed.
     */
    timeout?: number;
    /**
     * The protocol to use for the health check. Currently supported protocols are
     * 'HTTP', 'HTTPS' and 'TCP'.
     */
    type?: string;
}
/**
 * Parameters specific to an HTTP or HTTPS health check.
 */
export interface HTTPConfiguration {
    /**
     * Do not validate the certificate when the health check uses HTTPS.
     */
    allow_insecure?: boolean;
    /**
     * A case-insensitive sub-string to look for in the response body. If this string
     * is not found, the origin will be marked as unhealthy.
     */
    expected_body?: string;
    /**
     * The expected HTTP response codes (e.g. "200") or code ranges (e.g. "2xx" for all
     * codes starting with 2) of the health check.
     */
    expected_codes?: Array<string> | null;
    /**
     * Follow redirects if the origin returns a 3xx status code.
     */
    follow_redirects?: boolean;
    /**
     * The HTTP request headers to send in the health check. It is recommended you set
     * a Host header by default. The User-Agent header cannot be overridden.
     */
    header?: {
        [key: string]: Array<string>;
    } | null;
    /**
     * The HTTP method to use for the health check.
     */
    method?: 'GET' | 'HEAD';
    /**
     * The endpoint path to health check against.
     */
    path?: string;
    /**
     * Port number to connect to for the health check. Defaults to 80 if type is HTTP
     * or 443 if type is HTTPS.
     */
    port?: number;
}
/**
 * Parameters specific to an HTTP or HTTPS health check.
 */
export interface HTTPConfigurationParam {
    /**
     * Do not validate the certificate when the health check uses HTTPS.
     */
    allow_insecure?: boolean;
    /**
     * A case-insensitive sub-string to look for in the response body. If this string
     * is not found, the origin will be marked as unhealthy.
     */
    expected_body?: string;
    /**
     * The expected HTTP response codes (e.g. "200") or code ranges (e.g. "2xx" for all
     * codes starting with 2) of the health check.
     */
    expected_codes?: Array<string> | null;
    /**
     * Follow redirects if the origin returns a 3xx status code.
     */
    follow_redirects?: boolean;
    /**
     * The HTTP request headers to send in the health check. It is recommended you set
     * a Host header by default. The User-Agent header cannot be overridden.
     */
    header?: {
        [key: string]: Array<string>;
    } | null;
    /**
     * The HTTP method to use for the health check.
     */
    method?: 'GET' | 'HEAD';
    /**
     * The endpoint path to health check against.
     */
    path?: string;
    /**
     * Port number to connect to for the health check. Defaults to 80 if type is HTTP
     * or 443 if type is HTTPS.
     */
    port?: number;
}
export interface QueryHealthcheck {
    /**
     * The hostname or IP address of the origin server to run health checks on.
     */
    address: string;
    /**
     * A short name to identify the health check. Only alphanumeric characters, hyphens
     * and underscores are allowed.
     */
    name: string;
    /**
     * A list of regions from which to run health checks. Null means Cloudflare will
     * pick a default region.
     */
    check_regions?: Array<CheckRegion> | null;
    /**
     * The number of consecutive fails required from a health check before changing the
     * health to unhealthy.
     */
    consecutive_fails?: number;
    /**
     * The number of consecutive successes required from a health check before changing
     * the health to healthy.
     */
    consecutive_successes?: number;
    /**
     * A human-readable description of the health check.
     */
    description?: string;
    /**
     * Parameters specific to an HTTP or HTTPS health check.
     */
    http_config?: HTTPConfiguration | null;
    /**
     * The interval between each health check. Shorter intervals may give quicker
     * notifications if the origin status changes, but will increase load on the origin
     * as we check from multiple locations.
     */
    interval?: number;
    /**
     * The number of retries to attempt in case of a timeout before marking the origin
     * as unhealthy. Retries are attempted immediately.
     */
    retries?: number;
    /**
     * If suspended, no health checks are sent to the origin.
     */
    suspended?: boolean;
    /**
     * Parameters specific to TCP health check.
     */
    tcp_config?: TCPConfiguration | null;
    /**
     * The timeout (in seconds) before marking the health check as failed.
     */
    timeout?: number;
    /**
     * The protocol to use for the health check. Currently supported protocols are
     * 'HTTP', 'HTTPS' and 'TCP'.
     */
    type?: string;
}
/**
 * Parameters specific to TCP health check.
 */
export interface TCPConfiguration {
    /**
     * The TCP connection method to use for the health check.
     */
    method?: 'connection_established';
    /**
     * Port number to connect to for the health check. Defaults to 80.
     */
    port?: number;
}
/**
 * Parameters specific to TCP health check.
 */
export interface TCPConfigurationParam {
    /**
     * The TCP connection method to use for the health check.
     */
    method?: 'connection_established';
    /**
     * Port number to connect to for the health check. Defaults to 80.
     */
    port?: number;
}
export interface HealthcheckDeleteResponse {
    /**
     * Identifier
     */
    id?: string;
}
export interface HealthcheckCreateParams {
    /**
     * Path param: Identifier
     */
    zone_id: string;
    /**
     * Body param: The hostname or IP address of the origin server to run health checks
     * on.
     */
    address: string;
    /**
     * Body param: A short name to identify the health check. Only alphanumeric
     * characters, hyphens and underscores are allowed.
     */
    name: string;
    /**
     * Body param: A list of regions from which to run health checks. Null means
     * Cloudflare will pick a default region.
     */
    check_regions?: Array<CheckRegionParam> | null;
    /**
     * Body param: The number of consecutive fails required from a health check before
     * changing the health to unhealthy.
     */
    consecutive_fails?: number;
    /**
     * Body param: The number of consecutive successes required from a health check
     * before changing the health to healthy.
     */
    consecutive_successes?: number;
    /**
     * Body param: A human-readable description of the health check.
     */
    description?: string;
    /**
     * Body param: Parameters specific to an HTTP or HTTPS health check.
     */
    http_config?: HTTPConfigurationParam | null;
    /**
     * Body param: The interval between each health check. Shorter intervals may give
     * quicker notifications if the origin status changes, but will increase load on
     * the origin as we check from multiple locations.
     */
    interval?: number;
    /**
     * Body param: The number of retries to attempt in case of a timeout before marking
     * the origin as unhealthy. Retries are attempted immediately.
     */
    retries?: number;
    /**
     * Body param: If suspended, no health checks are sent to the origin.
     */
    suspended?: boolean;
    /**
     * Body param: Parameters specific to TCP health check.
     */
    tcp_config?: TCPConfigurationParam | null;
    /**
     * Body param: The timeout (in seconds) before marking the health check as failed.
     */
    timeout?: number;
    /**
     * Body param: The protocol to use for the health check. Currently supported
     * protocols are 'HTTP', 'HTTPS' and 'TCP'.
     */
    type?: string;
}
export interface HealthcheckUpdateParams {
    /**
     * Path param: Identifier
     */
    zone_id: string;
    /**
     * Body param: The hostname or IP address of the origin server to run health checks
     * on.
     */
    address: string;
    /**
     * Body param: A short name to identify the health check. Only alphanumeric
     * characters, hyphens and underscores are allowed.
     */
    name: string;
    /**
     * Body param: A list of regions from which to run health checks. Null means
     * Cloudflare will pick a default region.
     */
    check_regions?: Array<CheckRegionParam> | null;
    /**
     * Body param: The number of consecutive fails required from a health check before
     * changing the health to unhealthy.
     */
    consecutive_fails?: number;
    /**
     * Body param: The number of consecutive successes required from a health check
     * before changing the health to healthy.
     */
    consecutive_successes?: number;
    /**
     * Body param: A human-readable description of the health check.
     */
    description?: string;
    /**
     * Body param: Parameters specific to an HTTP or HTTPS health check.
     */
    http_config?: HTTPConfigurationParam | null;
    /**
     * Body param: The interval between each health check. Shorter intervals may give
     * quicker notifications if the origin status changes, but will increase load on
     * the origin as we check from multiple locations.
     */
    interval?: number;
    /**
     * Body param: The number of retries to attempt in case of a timeout before marking
     * the origin as unhealthy. Retries are attempted immediately.
     */
    retries?: number;
    /**
     * Body param: If suspended, no health checks are sent to the origin.
     */
    suspended?: boolean;
    /**
     * Body param: Parameters specific to TCP health check.
     */
    tcp_config?: TCPConfigurationParam | null;
    /**
     * Body param: The timeout (in seconds) before marking the health check as failed.
     */
    timeout?: number;
    /**
     * Body param: The protocol to use for the health check. Currently supported
     * protocols are 'HTTP', 'HTTPS' and 'TCP'.
     */
    type?: string;
}
export interface HealthcheckListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Identifier
     */
    zone_id: string;
}
export interface HealthcheckDeleteParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export interface HealthcheckEditParams {
    /**
     * Path param: Identifier
     */
    zone_id: string;
    /**
     * Body param: The hostname or IP address of the origin server to run health checks
     * on.
     */
    address: string;
    /**
     * Body param: A short name to identify the health check. Only alphanumeric
     * characters, hyphens and underscores are allowed.
     */
    name: string;
    /**
     * Body param: A list of regions from which to run health checks. Null means
     * Cloudflare will pick a default region.
     */
    check_regions?: Array<CheckRegionParam> | null;
    /**
     * Body param: The number of consecutive fails required from a health check before
     * changing the health to unhealthy.
     */
    consecutive_fails?: number;
    /**
     * Body param: The number of consecutive successes required from a health check
     * before changing the health to healthy.
     */
    consecutive_successes?: number;
    /**
     * Body param: A human-readable description of the health check.
     */
    description?: string;
    /**
     * Body param: Parameters specific to an HTTP or HTTPS health check.
     */
    http_config?: HTTPConfigurationParam | null;
    /**
     * Body param: The interval between each health check. Shorter intervals may give
     * quicker notifications if the origin status changes, but will increase load on
     * the origin as we check from multiple locations.
     */
    interval?: number;
    /**
     * Body param: The number of retries to attempt in case of a timeout before marking
     * the origin as unhealthy. Retries are attempted immediately.
     */
    retries?: number;
    /**
     * Body param: If suspended, no health checks are sent to the origin.
     */
    suspended?: boolean;
    /**
     * Body param: Parameters specific to TCP health check.
     */
    tcp_config?: TCPConfigurationParam | null;
    /**
     * Body param: The timeout (in seconds) before marking the health check as failed.
     */
    timeout?: number;
    /**
     * Body param: The protocol to use for the health check. Currently supported
     * protocols are 'HTTP', 'HTTPS' and 'TCP'.
     */
    type?: string;
}
export interface HealthcheckGetParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export declare namespace Healthchecks {
    export { type CheckRegion as CheckRegion, type Healthcheck as Healthcheck, type HTTPConfiguration as HTTPConfiguration, type QueryHealthcheck as QueryHealthcheck, type TCPConfiguration as TCPConfiguration, type HealthcheckDeleteResponse as HealthcheckDeleteResponse, HealthchecksV4PagePaginationArray as HealthchecksV4PagePaginationArray, type HealthcheckCreateParams as HealthcheckCreateParams, type HealthcheckUpdateParams as HealthcheckUpdateParams, type HealthcheckListParams as HealthcheckListParams, type HealthcheckDeleteParams as HealthcheckDeleteParams, type HealthcheckEditParams as HealthcheckEditParams, type HealthcheckGetParams as HealthcheckGetParams, };
    export { Previews as Previews, type PreviewDeleteResponse as PreviewDeleteResponse, type PreviewCreateParams as PreviewCreateParams, type PreviewDeleteParams as PreviewDeleteParams, type PreviewGetParams as PreviewGetParams, };
}
//# sourceMappingURL=healthchecks.d.ts.map