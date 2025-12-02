import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as HealthchecksAPI from "./healthchecks.js";
export declare class Previews extends APIResource {
    /**
     * Create a new preview health check.
     *
     * @example
     * ```ts
     * const healthcheck =
     *   await client.healthchecks.previews.create({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     address: 'www.example.com',
     *     name: 'server-1',
     *   });
     * ```
     */
    create(params: PreviewCreateParams, options?: Core.RequestOptions): Core.APIPromise<HealthchecksAPI.Healthcheck>;
    /**
     * Delete a health check.
     *
     * @example
     * ```ts
     * const preview = await client.healthchecks.previews.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(healthcheckId: string, params: PreviewDeleteParams, options?: Core.RequestOptions): Core.APIPromise<PreviewDeleteResponse>;
    /**
     * Fetch a single configured health check preview.
     *
     * @example
     * ```ts
     * const healthcheck = await client.healthchecks.previews.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(healthcheckId: string, params: PreviewGetParams, options?: Core.RequestOptions): Core.APIPromise<HealthchecksAPI.Healthcheck>;
}
export interface PreviewDeleteResponse {
    /**
     * Identifier
     */
    id?: string;
}
export interface PreviewCreateParams {
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
    check_regions?: Array<HealthchecksAPI.CheckRegionParam> | null;
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
    http_config?: HealthchecksAPI.HTTPConfigurationParam | null;
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
    tcp_config?: HealthchecksAPI.TCPConfigurationParam | null;
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
export interface PreviewDeleteParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export interface PreviewGetParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export declare namespace Previews {
    export { type PreviewDeleteResponse as PreviewDeleteResponse, type PreviewCreateParams as PreviewCreateParams, type PreviewDeleteParams as PreviewDeleteParams, type PreviewGetParams as PreviewGetParams, };
}
//# sourceMappingURL=previews.d.ts.map