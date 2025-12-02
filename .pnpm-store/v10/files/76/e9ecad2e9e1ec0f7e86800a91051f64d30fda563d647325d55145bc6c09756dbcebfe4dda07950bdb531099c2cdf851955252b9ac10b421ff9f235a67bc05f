// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Health extends APIResource {
  /**
   * Preview pool health using provided monitor details. The returned preview_id can
   * be used in the preview endpoint to retrieve the results.
   *
   * @example
   * ```ts
   * const health =
   *   await client.loadBalancers.pools.health.create(
   *     '17b5962d775c646f3f9725cbc7a53df4',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  create(
    poolId: string,
    params: HealthCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<HealthCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/load_balancers/pools/${poolId}/preview`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: HealthCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetch the latest pool health status for a single pool.
   *
   * @example
   * ```ts
   * const health = await client.loadBalancers.pools.health.get(
   *   '17b5962d775c646f3f9725cbc7a53df4',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    poolId: string,
    params: HealthGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<HealthGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/load_balancers/pools/${poolId}/health`,
        options,
      ) as Core.APIPromise<{ result: HealthGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface HealthCreateResponse {
  /**
   * Monitored pool IDs mapped to their respective names.
   */
  pools?: { [key: string]: string };

  preview_id?: string;
}

/**
 * A list of regions from which to run health checks. Null means every Cloudflare
 * data center.
 */
export interface HealthGetResponse {
  /**
   * Pool ID
   */
  pool_id?: string;

  /**
   * List of regions and associated health status.
   */
  pop_health?: HealthGetResponse.POPHealth;
}

export namespace HealthGetResponse {
  /**
   * List of regions and associated health status.
   */
  export interface POPHealth {
    /**
     * Whether health check in region is healthy.
     */
    healthy?: boolean;

    origins?: Array<POPHealth.Origin>;
  }

  export namespace POPHealth {
    export interface Origin {
      ip?: Origin.IP;
    }

    export namespace Origin {
      export interface IP {
        /**
         * Failure reason.
         */
        failure_reason?: string;

        /**
         * Origin health status.
         */
        healthy?: boolean;

        /**
         * Response code from origin health check.
         */
        response_code?: number;

        /**
         * Origin RTT (Round Trip Time) response.
         */
        rtt?: string;
      }
    }
  }
}

export interface HealthCreateParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Body param: Do not validate the certificate when monitor use HTTPS. This
   * parameter is currently only valid for HTTP and HTTPS monitors.
   */
  allow_insecure?: boolean;

  /**
   * Body param: To be marked unhealthy the monitored origin must fail this
   * healthcheck N consecutive times.
   */
  consecutive_down?: number;

  /**
   * Body param: To be marked healthy the monitored origin must pass this healthcheck
   * N consecutive times.
   */
  consecutive_up?: number;

  /**
   * Body param: Object description.
   */
  description?: string;

  /**
   * Body param: A case-insensitive sub-string to look for in the response body. If
   * this string is not found, the origin will be marked as unhealthy. This parameter
   * is only valid for HTTP and HTTPS monitors.
   */
  expected_body?: string;

  /**
   * Body param: The expected HTTP response code or code range of the health check.
   * This parameter is only valid for HTTP and HTTPS monitors.
   */
  expected_codes?: string;

  /**
   * Body param: Follow redirects if returned by the origin. This parameter is only
   * valid for HTTP and HTTPS monitors.
   */
  follow_redirects?: boolean;

  /**
   * Body param: The HTTP request headers to send in the health check. It is
   * recommended you set a Host header by default. The User-Agent header cannot be
   * overridden. This parameter is only valid for HTTP and HTTPS monitors.
   */
  header?: { [key: string]: Array<string> };

  /**
   * Body param: The interval between each health check. Shorter intervals may
   * improve failover time, but will increase load on the origins as we check from
   * multiple locations.
   */
  interval?: number;

  /**
   * Body param: The method to use for the health check. This defaults to 'GET' for
   * HTTP/HTTPS based checks and 'connection_established' for TCP based health
   * checks.
   */
  method?: string;

  /**
   * Body param: The endpoint path you want to conduct a health check against. This
   * parameter is only valid for HTTP and HTTPS monitors.
   */
  path?: string;

  /**
   * Body param: The port number to connect to for the health check. Required for
   * TCP, UDP, and SMTP checks. HTTP and HTTPS checks should only define the port
   * when using a non-standard port (HTTP: default 80, HTTPS: default 443).
   */
  port?: number;

  /**
   * Body param: Assign this monitor to emulate the specified zone while probing.
   * This parameter is only valid for HTTP and HTTPS monitors.
   */
  probe_zone?: string;

  /**
   * Body param: The number of retries to attempt in case of a timeout before marking
   * the origin as unhealthy. Retries are attempted immediately.
   */
  retries?: number;

  /**
   * Body param: The timeout (in seconds) before marking the health check as failed.
   */
  timeout?: number;

  /**
   * Body param: The protocol to use for the health check. Currently supported
   * protocols are 'HTTP','HTTPS', 'TCP', 'ICMP-PING', 'UDP-ICMP', and 'SMTP'.
   */
  type?: 'http' | 'https' | 'tcp' | 'udp_icmp' | 'icmp_ping' | 'smtp';
}

export interface HealthGetParams {
  /**
   * Identifier
   */
  account_id: string;
}

export declare namespace Health {
  export {
    type HealthCreateResponse as HealthCreateResponse,
    type HealthGetResponse as HealthGetResponse,
    type HealthCreateParams as HealthCreateParams,
    type HealthGetParams as HealthGetParams,
  };
}
