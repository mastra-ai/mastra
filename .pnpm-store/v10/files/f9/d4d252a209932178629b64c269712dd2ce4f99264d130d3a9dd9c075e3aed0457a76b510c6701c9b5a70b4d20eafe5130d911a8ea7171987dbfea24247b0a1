// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as LoadBalancersAPI from './load-balancers';
import * as PreviewsAPI from './previews';
import { PreviewGetParams, PreviewGetResponse, Previews } from './previews';
import * as RegionsAPI from './regions';
import { RegionGetParams, RegionGetResponse, RegionListParams, RegionListResponse, Regions } from './regions';
import * as SearchesAPI from './searches';
import {
  SearchListParams,
  SearchListResponse,
  SearchListResponsesV4PagePagination,
  Searches,
} from './searches';
import * as MonitorsAPI from './monitors/monitors';
import {
  Monitor,
  MonitorCreateParams,
  MonitorDeleteParams,
  MonitorDeleteResponse,
  MonitorEditParams,
  MonitorGetParams,
  MonitorListParams,
  MonitorUpdateParams,
  Monitors,
  MonitorsSinglePage,
} from './monitors/monitors';
import * as PoolsAPI from './pools/pools';
import {
  Pool,
  PoolBulkEditParams,
  PoolCreateParams,
  PoolDeleteParams,
  PoolDeleteResponse,
  PoolEditParams,
  PoolGetParams,
  PoolListParams,
  PoolUpdateParams,
  Pools,
  PoolsSinglePage,
} from './pools/pools';
import { SinglePage } from '../../pagination';

export class LoadBalancers extends APIResource {
  monitors: MonitorsAPI.Monitors = new MonitorsAPI.Monitors(this._client);
  pools: PoolsAPI.Pools = new PoolsAPI.Pools(this._client);
  previews: PreviewsAPI.Previews = new PreviewsAPI.Previews(this._client);
  regions: RegionsAPI.Regions = new RegionsAPI.Regions(this._client);
  searches: SearchesAPI.Searches = new SearchesAPI.Searches(this._client);

  /**
   * Create a new load balancer.
   *
   * @example
   * ```ts
   * const loadBalancer = await client.loadBalancers.create({
   *   zone_id: '699d98642c564d2e855e9661899b7252',
   *   default_pools: [
   *     '17b5962d775c646f3f9725cbc7a53df4',
   *     '9290f38c5d07c2e2f4df57b1f61d4196',
   *     '00920f38ce07c2e2f4df50b1f61d4194',
   *   ],
   *   fallback_pool: 'fallback_pool',
   *   name: 'www.example.com',
   * });
   * ```
   */
  create(params: LoadBalancerCreateParams, options?: Core.RequestOptions): Core.APIPromise<LoadBalancer> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/load_balancers`, { body, ...options }) as Core.APIPromise<{
        result: LoadBalancer;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update a configured load balancer.
   *
   * @example
   * ```ts
   * const loadBalancer = await client.loadBalancers.update(
   *   '699d98642c564d2e855e9661899b7252',
   *   {
   *     zone_id: '699d98642c564d2e855e9661899b7252',
   *     default_pools: [
   *       '17b5962d775c646f3f9725cbc7a53df4',
   *       '9290f38c5d07c2e2f4df57b1f61d4196',
   *       '00920f38ce07c2e2f4df50b1f61d4194',
   *     ],
   *     fallback_pool: 'fallback_pool',
   *     name: 'www.example.com',
   *   },
   * );
   * ```
   */
  update(
    loadBalancerId: string,
    params: LoadBalancerUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LoadBalancer> {
    const { zone_id, ...body } = params;
    return (
      this._client.put(`/zones/${zone_id}/load_balancers/${loadBalancerId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: LoadBalancer }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List configured load balancers.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const loadBalancer of client.loadBalancers.list({
   *   zone_id: '699d98642c564d2e855e9661899b7252',
   * })) {
   *   // ...
   * }
   * ```
   */
  list(
    params: LoadBalancerListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<LoadBalancersSinglePage, LoadBalancer> {
    const { zone_id } = params;
    return this._client.getAPIList(`/zones/${zone_id}/load_balancers`, LoadBalancersSinglePage, options);
  }

  /**
   * Delete a configured load balancer.
   *
   * @example
   * ```ts
   * const loadBalancer = await client.loadBalancers.delete(
   *   '699d98642c564d2e855e9661899b7252',
   *   { zone_id: '699d98642c564d2e855e9661899b7252' },
   * );
   * ```
   */
  delete(
    loadBalancerId: string,
    params: LoadBalancerDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LoadBalancerDeleteResponse> {
    const { zone_id } = params;
    return (
      this._client.delete(`/zones/${zone_id}/load_balancers/${loadBalancerId}`, options) as Core.APIPromise<{
        result: LoadBalancerDeleteResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Apply changes to an existing load balancer, overwriting the supplied properties.
   *
   * @example
   * ```ts
   * const loadBalancer = await client.loadBalancers.edit(
   *   '699d98642c564d2e855e9661899b7252',
   *   { zone_id: '699d98642c564d2e855e9661899b7252' },
   * );
   * ```
   */
  edit(
    loadBalancerId: string,
    params: LoadBalancerEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LoadBalancer> {
    const { zone_id, ...body } = params;
    return (
      this._client.patch(`/zones/${zone_id}/load_balancers/${loadBalancerId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: LoadBalancer }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetch a single configured load balancer.
   *
   * @example
   * ```ts
   * const loadBalancer = await client.loadBalancers.get(
   *   '699d98642c564d2e855e9661899b7252',
   *   { zone_id: '699d98642c564d2e855e9661899b7252' },
   * );
   * ```
   */
  get(
    loadBalancerId: string,
    params: LoadBalancerGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LoadBalancer> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/load_balancers/${loadBalancerId}`, options) as Core.APIPromise<{
        result: LoadBalancer;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class LoadBalancersSinglePage extends SinglePage<LoadBalancer> {}

/**
 * Controls features that modify the routing of requests to pools and origins in
 * response to dynamic conditions, such as during the interval between active
 * health monitoring requests. For example, zero-downtime failover occurs
 * immediately when an origin becomes unavailable due to HTTP 521, 522, or 523
 * response codes. If there is another healthy origin in the same pool, the request
 * is retried once against this alternate origin.
 */
export interface AdaptiveRouting {
  /**
   * Extends zero-downtime failover of requests to healthy origins from alternate
   * pools, when no healthy alternate exists in the same pool, according to the
   * failover order defined by traffic and origin steering. When set false (the
   * default) zero-downtime failover will only occur between origins within the same
   * pool. See `session_affinity_attributes` for control over when sessions are
   * broken or reassigned.
   */
  failover_across_pools?: boolean;
}

/**
 * Controls features that modify the routing of requests to pools and origins in
 * response to dynamic conditions, such as during the interval between active
 * health monitoring requests. For example, zero-downtime failover occurs
 * immediately when an origin becomes unavailable due to HTTP 521, 522, or 523
 * response codes. If there is another healthy origin in the same pool, the request
 * is retried once against this alternate origin.
 */
export interface AdaptiveRoutingParam {
  /**
   * Extends zero-downtime failover of requests to healthy origins from alternate
   * pools, when no healthy alternate exists in the same pool, according to the
   * failover order defined by traffic and origin steering. When set false (the
   * default) zero-downtime failover will only occur between origins within the same
   * pool. See `session_affinity_attributes` for control over when sessions are
   * broken or reassigned.
   */
  failover_across_pools?: boolean;
}

/**
 * WNAM: Western North America, ENAM: Eastern North America, WEU: Western Europe,
 * EEU: Eastern Europe, NSAM: Northern South America, SSAM: Southern South America,
 * OC: Oceania, ME: Middle East, NAF: North Africa, SAF: South Africa, SAS:
 * Southern Asia, SEAS: South East Asia, NEAS: North East Asia, ALL_REGIONS: all
 * regions (ENTERPRISE customers only).
 */
export type CheckRegion =
  | 'WNAM'
  | 'ENAM'
  | 'WEU'
  | 'EEU'
  | 'NSAM'
  | 'SSAM'
  | 'OC'
  | 'ME'
  | 'NAF'
  | 'SAF'
  | 'SAS'
  | 'SEAS'
  | 'NEAS'
  | 'ALL_REGIONS';

/**
 * WNAM: Western North America, ENAM: Eastern North America, WEU: Western Europe,
 * EEU: Eastern Europe, NSAM: Northern South America, SSAM: Southern South America,
 * OC: Oceania, ME: Middle East, NAF: North Africa, SAF: South Africa, SAS:
 * Southern Asia, SEAS: South East Asia, NEAS: North East Asia, ALL_REGIONS: all
 * regions (ENTERPRISE customers only).
 */
export type CheckRegionParam =
  | 'WNAM'
  | 'ENAM'
  | 'WEU'
  | 'EEU'
  | 'NSAM'
  | 'SSAM'
  | 'OC'
  | 'ME'
  | 'NAF'
  | 'SAF'
  | 'SAS'
  | 'SEAS'
  | 'NEAS'
  | 'ALL_REGIONS';

/**
 * A pool ID.
 */
export type DefaultPools = string;

/**
 * A pool ID.
 */
export type DefaultPoolsParam = string;

/**
 * Filter options for a particular resource type (pool or origin). Use null to
 * reset.
 */
export interface FilterOptions {
  /**
   * If set true, disable notifications for this type of resource (pool or origin).
   */
  disable?: boolean;

  /**
   * If present, send notifications only for this health status (e.g. false for only
   * DOWN events). Use null to reset (all events).
   */
  healthy?: boolean | null;
}

/**
 * Filter options for a particular resource type (pool or origin). Use null to
 * reset.
 */
export interface FilterOptionsParam {
  /**
   * If set true, disable notifications for this type of resource (pool or origin).
   */
  disable?: boolean;

  /**
   * If present, send notifications only for this health status (e.g. false for only
   * DOWN events). Use null to reset (all events).
   */
  healthy?: boolean | null;
}

/**
 * The request header is used to pass additional information with an HTTP request.
 * Currently supported header is 'Host'.
 */
export interface Header {
  /**
   * The 'Host' header allows to override the hostname set in the HTTP request.
   * Current support is 1 'Host' header override per origin.
   */
  Host?: Array<Host>;
}

/**
 * The request header is used to pass additional information with an HTTP request.
 * Currently supported header is 'Host'.
 */
export interface HeaderParam {
  /**
   * The 'Host' header allows to override the hostname set in the HTTP request.
   * Current support is 1 'Host' header override per origin.
   */
  Host?: Array<HostParam>;
}

export type Host = string;

export type HostParam = string;

export interface LoadBalancer {
  id?: string;

  /**
   * Controls features that modify the routing of requests to pools and origins in
   * response to dynamic conditions, such as during the interval between active
   * health monitoring requests. For example, zero-downtime failover occurs
   * immediately when an origin becomes unavailable due to HTTP 521, 522, or 523
   * response codes. If there is another healthy origin in the same pool, the request
   * is retried once against this alternate origin.
   */
  adaptive_routing?: AdaptiveRouting;

  /**
   * A mapping of country codes to a list of pool IDs (ordered by their failover
   * priority) for the given country. Any country not explicitly defined will fall
   * back to using the corresponding region_pool mapping if it exists else to
   * default_pools.
   */
  country_pools?: { [key: string]: Array<string> };

  created_on?: string;

  /**
   * A list of pool IDs ordered by their failover priority. Pools defined here are
   * used by default, or when region_pools are not configured for a given region.
   */
  default_pools?: Array<DefaultPools>;

  /**
   * Object description.
   */
  description?: string;

  /**
   * Whether to enable (the default) this load balancer.
   */
  enabled?: boolean;

  /**
   * The pool ID to use when all other pools are detected as unhealthy.
   */
  fallback_pool?: string;

  /**
   * Controls location-based steering for non-proxied requests. See `steering_policy`
   * to learn how steering is affected.
   */
  location_strategy?: LocationStrategy;

  modified_on?: string;

  /**
   * The DNS hostname to associate with your Load Balancer. If this hostname already
   * exists as a DNS record in Cloudflare's DNS, the Load Balancer will take
   * precedence and the DNS record will not be used.
   */
  name?: string;

  /**
   * List of networks where Load Balancer or Pool is enabled.
   */
  networks?: Array<string>;

  /**
   * (Enterprise only): A mapping of Cloudflare PoP identifiers to a list of pool IDs
   * (ordered by their failover priority) for the PoP (datacenter). Any PoPs not
   * explicitly defined will fall back to using the corresponding country_pool, then
   * region_pool mapping if it exists else to default_pools.
   */
  pop_pools?: { [key: string]: Array<string> };

  /**
   * Whether the hostname should be gray clouded (false) or orange clouded (true).
   */
  proxied?: boolean;

  /**
   * Configures pool weights.
   *
   * - `steering_policy="random"`: A random pool is selected with probability
   *   proportional to pool weights.
   * - `steering_policy="least_outstanding_requests"`: Use pool weights to scale each
   *   pool's outstanding requests.
   * - `steering_policy="least_connections"`: Use pool weights to scale each pool's
   *   open connections.
   */
  random_steering?: RandomSteering;

  /**
   * A mapping of region codes to a list of pool IDs (ordered by their failover
   * priority) for the given region. Any regions not explicitly defined will fall
   * back to using default_pools.
   */
  region_pools?: { [key: string]: Array<string> };

  /**
   * BETA Field Not General Access: A list of rules for this load balancer to
   * execute.
   */
  rules?: Array<Rules>;

  /**
   * Specifies the type of session affinity the load balancer should use unless
   * specified as `"none"`. The supported types are:
   *
   * - `"cookie"`: On the first request to a proxied load balancer, a cookie is
   *   generated, encoding information of which origin the request will be forwarded
   *   to. Subsequent requests, by the same client to the same load balancer, will be
   *   sent to the origin server the cookie encodes, for the duration of the cookie
   *   and as long as the origin server remains healthy. If the cookie has expired or
   *   the origin server is unhealthy, then a new origin server is calculated and
   *   used.
   * - `"ip_cookie"`: Behaves the same as `"cookie"` except the initial origin
   *   selection is stable and based on the client's ip address.
   * - `"header"`: On the first request to a proxied load balancer, a session key
   *   based on the configured HTTP headers (see
   *   `session_affinity_attributes.headers`) is generated, encoding the request
   *   headers used for storing in the load balancer session state which origin the
   *   request will be forwarded to. Subsequent requests to the load balancer with
   *   the same headers will be sent to the same origin server, for the duration of
   *   the session and as long as the origin server remains healthy. If the session
   *   has been idle for the duration of `session_affinity_ttl` seconds or the origin
   *   server is unhealthy, then a new origin server is calculated and used. See
   *   `headers` in `session_affinity_attributes` for additional required
   *   configuration.
   */
  session_affinity?: SessionAffinity;

  /**
   * Configures attributes for session affinity.
   */
  session_affinity_attributes?: SessionAffinityAttributes;

  /**
   * Time, in seconds, until a client's session expires after being created. Once the
   * expiry time has been reached, subsequent requests may get sent to a different
   * origin server. The accepted ranges per `session_affinity` policy are:
   *
   * - `"cookie"` / `"ip_cookie"`: The current default of 23 hours will be used
   *   unless explicitly set. The accepted range of values is between [1800, 604800].
   * - `"header"`: The current default of 1800 seconds will be used unless explicitly
   *   set. The accepted range of values is between [30, 3600]. Note: With session
   *   affinity by header, sessions only expire after they haven't been used for the
   *   number of seconds specified.
   */
  session_affinity_ttl?: number;

  /**
   * Steering Policy for this load balancer.
   *
   * - `"off"`: Use `default_pools`.
   * - `"geo"`: Use `region_pools`/`country_pools`/`pop_pools`. For non-proxied
   *   requests, the country for `country_pools` is determined by
   *   `location_strategy`.
   * - `"random"`: Select a pool randomly.
   * - `"dynamic_latency"`: Use round trip time to select the closest pool in
   *   default_pools (requires pool health checks).
   * - `"proximity"`: Use the pools' latitude and longitude to select the closest
   *   pool using the Cloudflare PoP location for proxied requests or the location
   *   determined by `location_strategy` for non-proxied requests.
   * - `"least_outstanding_requests"`: Select a pool by taking into consideration
   *   `random_steering` weights, as well as each pool's number of outstanding
   *   requests. Pools with more pending requests are weighted proportionately less
   *   relative to others.
   * - `"least_connections"`: Select a pool by taking into consideration
   *   `random_steering` weights, as well as each pool's number of open connections.
   *   Pools with more open connections are weighted proportionately less relative to
   *   others. Supported for HTTP/1 and HTTP/2 connections.
   * - `""`: Will map to `"geo"` if you use
   *   `region_pools`/`country_pools`/`pop_pools` otherwise `"off"`.
   */
  steering_policy?: SteeringPolicy;

  /**
   * Time to live (TTL) of the DNS entry for the IP address returned by this load
   * balancer. This only applies to gray-clouded (unproxied) load balancers.
   */
  ttl?: number;

  zone_name?: string;
}

/**
 * Configures load shedding policies and percentages for the pool.
 */
export interface LoadShedding {
  /**
   * The percent of traffic to shed from the pool, according to the default policy.
   * Applies to new sessions and traffic without session affinity.
   */
  default_percent?: number;

  /**
   * The default policy to use when load shedding. A random policy randomly sheds a
   * given percent of requests. A hash policy computes a hash over the
   * CF-Connecting-IP address and sheds all requests originating from a percent of
   * IPs.
   */
  default_policy?: 'random' | 'hash';

  /**
   * The percent of existing sessions to shed from the pool, according to the session
   * policy.
   */
  session_percent?: number;

  /**
   * Only the hash policy is supported for existing sessions (to avoid exponential
   * decay).
   */
  session_policy?: 'hash';
}

/**
 * Configures load shedding policies and percentages for the pool.
 */
export interface LoadSheddingParam {
  /**
   * The percent of traffic to shed from the pool, according to the default policy.
   * Applies to new sessions and traffic without session affinity.
   */
  default_percent?: number;

  /**
   * The default policy to use when load shedding. A random policy randomly sheds a
   * given percent of requests. A hash policy computes a hash over the
   * CF-Connecting-IP address and sheds all requests originating from a percent of
   * IPs.
   */
  default_policy?: 'random' | 'hash';

  /**
   * The percent of existing sessions to shed from the pool, according to the session
   * policy.
   */
  session_percent?: number;

  /**
   * Only the hash policy is supported for existing sessions (to avoid exponential
   * decay).
   */
  session_policy?: 'hash';
}

/**
 * Controls location-based steering for non-proxied requests. See `steering_policy`
 * to learn how steering is affected.
 */
export interface LocationStrategy {
  /**
   * Determines the authoritative location when ECS is not preferred, does not exist
   * in the request, or its GeoIP lookup is unsuccessful.
   *
   * - `"pop"`: Use the Cloudflare PoP location.
   * - `"resolver_ip"`: Use the DNS resolver GeoIP location. If the GeoIP lookup is
   *   unsuccessful, use the Cloudflare PoP location.
   */
  mode?: 'pop' | 'resolver_ip';

  /**
   * Whether the EDNS Client Subnet (ECS) GeoIP should be preferred as the
   * authoritative location.
   *
   * - `"always"`: Always prefer ECS.
   * - `"never"`: Never prefer ECS.
   * - `"proximity"`: Prefer ECS only when `steering_policy="proximity"`.
   * - `"geo"`: Prefer ECS only when `steering_policy="geo"`.
   */
  prefer_ecs?: 'always' | 'never' | 'proximity' | 'geo';
}

/**
 * Controls location-based steering for non-proxied requests. See `steering_policy`
 * to learn how steering is affected.
 */
export interface LocationStrategyParam {
  /**
   * Determines the authoritative location when ECS is not preferred, does not exist
   * in the request, or its GeoIP lookup is unsuccessful.
   *
   * - `"pop"`: Use the Cloudflare PoP location.
   * - `"resolver_ip"`: Use the DNS resolver GeoIP location. If the GeoIP lookup is
   *   unsuccessful, use the Cloudflare PoP location.
   */
  mode?: 'pop' | 'resolver_ip';

  /**
   * Whether the EDNS Client Subnet (ECS) GeoIP should be preferred as the
   * authoritative location.
   *
   * - `"always"`: Always prefer ECS.
   * - `"never"`: Never prefer ECS.
   * - `"proximity"`: Prefer ECS only when `steering_policy="proximity"`.
   * - `"geo"`: Prefer ECS only when `steering_policy="geo"`.
   */
  prefer_ecs?: 'always' | 'never' | 'proximity' | 'geo';
}

/**
 * Filter pool and origin health notifications by resource type or health status.
 * Use null to reset.
 */
export interface NotificationFilter {
  /**
   * Filter options for a particular resource type (pool or origin). Use null to
   * reset.
   */
  origin?: FilterOptions | null;

  /**
   * Filter options for a particular resource type (pool or origin). Use null to
   * reset.
   */
  pool?: FilterOptions | null;
}

/**
 * Filter pool and origin health notifications by resource type or health status.
 * Use null to reset.
 */
export interface NotificationFilterParam {
  /**
   * Filter options for a particular resource type (pool or origin). Use null to
   * reset.
   */
  origin?: FilterOptionsParam | null;

  /**
   * Filter options for a particular resource type (pool or origin). Use null to
   * reset.
   */
  pool?: FilterOptionsParam | null;
}

export interface Origin {
  /**
   * The IP address (IPv4 or IPv6) of the origin, or its publicly addressable
   * hostname. Hostnames entered here should resolve directly to the origin, and not
   * be a hostname proxied by Cloudflare. To set an internal/reserved address,
   * virtual_network_id must also be set.
   */
  address?: string;

  /**
   * This field shows up only if the origin is disabled. This field is set with the
   * time the origin was disabled.
   */
  disabled_at?: string;

  /**
   * Whether to enable (the default) this origin within the pool. Disabled origins
   * will not receive traffic and are excluded from health checks. The origin will
   * only be disabled for the current pool.
   */
  enabled?: boolean;

  /**
   * The request header is used to pass additional information with an HTTP request.
   * Currently supported header is 'Host'.
   */
  header?: Header;

  /**
   * A human-identifiable name for the origin.
   */
  name?: string;

  /**
   * The port for upstream connections. A value of 0 means the default port for the
   * protocol will be used.
   */
  port?: number;

  /**
   * The virtual network subnet ID the origin belongs in. Virtual network must also
   * belong to the account.
   */
  virtual_network_id?: string;

  /**
   * The weight of this origin relative to other origins in the pool. Based on the
   * configured weight the total traffic is distributed among origins within the
   * pool.
   *
   * - `origin_steering.policy="least_outstanding_requests"`: Use weight to scale the
   *   origin's outstanding requests.
   * - `origin_steering.policy="least_connections"`: Use weight to scale the origin's
   *   open connections.
   */
  weight?: number;
}

export interface OriginParam {
  /**
   * The IP address (IPv4 or IPv6) of the origin, or its publicly addressable
   * hostname. Hostnames entered here should resolve directly to the origin, and not
   * be a hostname proxied by Cloudflare. To set an internal/reserved address,
   * virtual_network_id must also be set.
   */
  address?: string;

  /**
   * Whether to enable (the default) this origin within the pool. Disabled origins
   * will not receive traffic and are excluded from health checks. The origin will
   * only be disabled for the current pool.
   */
  enabled?: boolean;

  /**
   * The request header is used to pass additional information with an HTTP request.
   * Currently supported header is 'Host'.
   */
  header?: HeaderParam;

  /**
   * A human-identifiable name for the origin.
   */
  name?: string;

  /**
   * The port for upstream connections. A value of 0 means the default port for the
   * protocol will be used.
   */
  port?: number;

  /**
   * The virtual network subnet ID the origin belongs in. Virtual network must also
   * belong to the account.
   */
  virtual_network_id?: string;

  /**
   * The weight of this origin relative to other origins in the pool. Based on the
   * configured weight the total traffic is distributed among origins within the
   * pool.
   *
   * - `origin_steering.policy="least_outstanding_requests"`: Use weight to scale the
   *   origin's outstanding requests.
   * - `origin_steering.policy="least_connections"`: Use weight to scale the origin's
   *   open connections.
   */
  weight?: number;
}

/**
 * Configures origin steering for the pool. Controls how origins are selected for
 * new sessions and traffic without session affinity.
 */
export interface OriginSteering {
  /**
   * The type of origin steering policy to use.
   *
   * - `"random"`: Select an origin randomly.
   * - `"hash"`: Select an origin by computing a hash over the CF-Connecting-IP
   *   address.
   * - `"least_outstanding_requests"`: Select an origin by taking into consideration
   *   origin weights, as well as each origin's number of outstanding requests.
   *   Origins with more pending requests are weighted proportionately less relative
   *   to others.
   * - `"least_connections"`: Select an origin by taking into consideration origin
   *   weights, as well as each origin's number of open connections. Origins with
   *   more open connections are weighted proportionately less relative to others.
   *   Supported for HTTP/1 and HTTP/2 connections.
   */
  policy?: 'random' | 'hash' | 'least_outstanding_requests' | 'least_connections';
}

/**
 * Configures origin steering for the pool. Controls how origins are selected for
 * new sessions and traffic without session affinity.
 */
export interface OriginSteeringParam {
  /**
   * The type of origin steering policy to use.
   *
   * - `"random"`: Select an origin randomly.
   * - `"hash"`: Select an origin by computing a hash over the CF-Connecting-IP
   *   address.
   * - `"least_outstanding_requests"`: Select an origin by taking into consideration
   *   origin weights, as well as each origin's number of outstanding requests.
   *   Origins with more pending requests are weighted proportionately less relative
   *   to others.
   * - `"least_connections"`: Select an origin by taking into consideration origin
   *   weights, as well as each origin's number of open connections. Origins with
   *   more open connections are weighted proportionately less relative to others.
   *   Supported for HTTP/1 and HTTP/2 connections.
   */
  policy?: 'random' | 'hash' | 'least_outstanding_requests' | 'least_connections';
}

/**
 * Configures pool weights.
 *
 * - `steering_policy="random"`: A random pool is selected with probability
 *   proportional to pool weights.
 * - `steering_policy="least_outstanding_requests"`: Use pool weights to scale each
 *   pool's outstanding requests.
 * - `steering_policy="least_connections"`: Use pool weights to scale each pool's
 *   open connections.
 */
export interface RandomSteering {
  /**
   * The default weight for pools in the load balancer that are not specified in the
   * pool_weights map.
   */
  default_weight?: number;

  /**
   * A mapping of pool IDs to custom weights. The weight is relative to other pools
   * in the load balancer.
   */
  pool_weights?: { [key: string]: number };
}

/**
 * Configures pool weights.
 *
 * - `steering_policy="random"`: A random pool is selected with probability
 *   proportional to pool weights.
 * - `steering_policy="least_outstanding_requests"`: Use pool weights to scale each
 *   pool's outstanding requests.
 * - `steering_policy="least_connections"`: Use pool weights to scale each pool's
 *   open connections.
 */
export interface RandomSteeringParam {
  /**
   * The default weight for pools in the load balancer that are not specified in the
   * pool_weights map.
   */
  default_weight?: number;

  /**
   * A mapping of pool IDs to custom weights. The weight is relative to other pools
   * in the load balancer.
   */
  pool_weights?: { [key: string]: number };
}

/**
 * A rule object containing conditions and overrides for this load balancer to
 * evaluate.
 */
export interface Rules {
  /**
   * The condition expressions to evaluate. If the condition evaluates to true, the
   * overrides or fixed_response in this rule will be applied. An empty condition is
   * always true. For more details on condition expressions, please see
   * https://developers.cloudflare.com/load-balancing/understand-basics/load-balancing-rules/expressions.
   */
  condition?: string;

  /**
   * Disable this specific rule. It will no longer be evaluated by this load
   * balancer.
   */
  disabled?: boolean;

  /**
   * A collection of fields used to directly respond to the eyeball instead of
   * routing to a pool. If a fixed_response is supplied the rule will be marked as
   * terminates.
   */
  fixed_response?: Rules.FixedResponse;

  /**
   * Name of this rule. Only used for human readability.
   */
  name?: string;

  /**
   * A collection of overrides to apply to the load balancer when this rule's
   * condition is true. All fields are optional.
   */
  overrides?: Rules.Overrides;

  /**
   * The order in which rules should be executed in relation to each other. Lower
   * values are executed first. Values do not need to be sequential. If no value is
   * provided for any rule the array order of the rules field will be used to assign
   * a priority.
   */
  priority?: number;

  /**
   * If this rule's condition is true, this causes rule evaluation to stop after
   * processing this rule.
   */
  terminates?: boolean;
}

export namespace Rules {
  /**
   * A collection of fields used to directly respond to the eyeball instead of
   * routing to a pool. If a fixed_response is supplied the rule will be marked as
   * terminates.
   */
  export interface FixedResponse {
    /**
     * The http 'Content-Type' header to include in the response.
     */
    content_type?: string;

    /**
     * The http 'Location' header to include in the response.
     */
    location?: string;

    /**
     * Text to include as the http body.
     */
    message_body?: string;

    /**
     * The http status code to respond with.
     */
    status_code?: number;
  }

  /**
   * A collection of overrides to apply to the load balancer when this rule's
   * condition is true. All fields are optional.
   */
  export interface Overrides {
    /**
     * Controls features that modify the routing of requests to pools and origins in
     * response to dynamic conditions, such as during the interval between active
     * health monitoring requests. For example, zero-downtime failover occurs
     * immediately when an origin becomes unavailable due to HTTP 521, 522, or 523
     * response codes. If there is another healthy origin in the same pool, the request
     * is retried once against this alternate origin.
     */
    adaptive_routing?: LoadBalancersAPI.AdaptiveRouting;

    /**
     * A mapping of country codes to a list of pool IDs (ordered by their failover
     * priority) for the given country. Any country not explicitly defined will fall
     * back to using the corresponding region_pool mapping if it exists else to
     * default_pools.
     */
    country_pools?: { [key: string]: Array<string> };

    /**
     * A list of pool IDs ordered by their failover priority. Pools defined here are
     * used by default, or when region_pools are not configured for a given region.
     */
    default_pools?: Array<LoadBalancersAPI.DefaultPools>;

    /**
     * The pool ID to use when all other pools are detected as unhealthy.
     */
    fallback_pool?: string;

    /**
     * Controls location-based steering for non-proxied requests. See `steering_policy`
     * to learn how steering is affected.
     */
    location_strategy?: LoadBalancersAPI.LocationStrategy;

    /**
     * (Enterprise only): A mapping of Cloudflare PoP identifiers to a list of pool IDs
     * (ordered by their failover priority) for the PoP (datacenter). Any PoPs not
     * explicitly defined will fall back to using the corresponding country_pool, then
     * region_pool mapping if it exists else to default_pools.
     */
    pop_pools?: { [key: string]: Array<string> };

    /**
     * Configures pool weights.
     *
     * - `steering_policy="random"`: A random pool is selected with probability
     *   proportional to pool weights.
     * - `steering_policy="least_outstanding_requests"`: Use pool weights to scale each
     *   pool's outstanding requests.
     * - `steering_policy="least_connections"`: Use pool weights to scale each pool's
     *   open connections.
     */
    random_steering?: LoadBalancersAPI.RandomSteering;

    /**
     * A mapping of region codes to a list of pool IDs (ordered by their failover
     * priority) for the given region. Any regions not explicitly defined will fall
     * back to using default_pools.
     */
    region_pools?: { [key: string]: Array<string> };

    /**
     * Specifies the type of session affinity the load balancer should use unless
     * specified as `"none"`. The supported types are:
     *
     * - `"cookie"`: On the first request to a proxied load balancer, a cookie is
     *   generated, encoding information of which origin the request will be forwarded
     *   to. Subsequent requests, by the same client to the same load balancer, will be
     *   sent to the origin server the cookie encodes, for the duration of the cookie
     *   and as long as the origin server remains healthy. If the cookie has expired or
     *   the origin server is unhealthy, then a new origin server is calculated and
     *   used.
     * - `"ip_cookie"`: Behaves the same as `"cookie"` except the initial origin
     *   selection is stable and based on the client's ip address.
     * - `"header"`: On the first request to a proxied load balancer, a session key
     *   based on the configured HTTP headers (see
     *   `session_affinity_attributes.headers`) is generated, encoding the request
     *   headers used for storing in the load balancer session state which origin the
     *   request will be forwarded to. Subsequent requests to the load balancer with
     *   the same headers will be sent to the same origin server, for the duration of
     *   the session and as long as the origin server remains healthy. If the session
     *   has been idle for the duration of `session_affinity_ttl` seconds or the origin
     *   server is unhealthy, then a new origin server is calculated and used. See
     *   `headers` in `session_affinity_attributes` for additional required
     *   configuration.
     */
    session_affinity?: LoadBalancersAPI.SessionAffinity;

    /**
     * Configures attributes for session affinity.
     */
    session_affinity_attributes?: LoadBalancersAPI.SessionAffinityAttributes;

    /**
     * Time, in seconds, until a client's session expires after being created. Once the
     * expiry time has been reached, subsequent requests may get sent to a different
     * origin server. The accepted ranges per `session_affinity` policy are:
     *
     * - `"cookie"` / `"ip_cookie"`: The current default of 23 hours will be used
     *   unless explicitly set. The accepted range of values is between [1800, 604800].
     * - `"header"`: The current default of 1800 seconds will be used unless explicitly
     *   set. The accepted range of values is between [30, 3600]. Note: With session
     *   affinity by header, sessions only expire after they haven't been used for the
     *   number of seconds specified.
     */
    session_affinity_ttl?: number;

    /**
     * Steering Policy for this load balancer.
     *
     * - `"off"`: Use `default_pools`.
     * - `"geo"`: Use `region_pools`/`country_pools`/`pop_pools`. For non-proxied
     *   requests, the country for `country_pools` is determined by
     *   `location_strategy`.
     * - `"random"`: Select a pool randomly.
     * - `"dynamic_latency"`: Use round trip time to select the closest pool in
     *   default_pools (requires pool health checks).
     * - `"proximity"`: Use the pools' latitude and longitude to select the closest
     *   pool using the Cloudflare PoP location for proxied requests or the location
     *   determined by `location_strategy` for non-proxied requests.
     * - `"least_outstanding_requests"`: Select a pool by taking into consideration
     *   `random_steering` weights, as well as each pool's number of outstanding
     *   requests. Pools with more pending requests are weighted proportionately less
     *   relative to others.
     * - `"least_connections"`: Select a pool by taking into consideration
     *   `random_steering` weights, as well as each pool's number of open connections.
     *   Pools with more open connections are weighted proportionately less relative to
     *   others. Supported for HTTP/1 and HTTP/2 connections.
     * - `""`: Will map to `"geo"` if you use
     *   `region_pools`/`country_pools`/`pop_pools` otherwise `"off"`.
     */
    steering_policy?: LoadBalancersAPI.SteeringPolicy;

    /**
     * Time to live (TTL) of the DNS entry for the IP address returned by this load
     * balancer. This only applies to gray-clouded (unproxied) load balancers.
     */
    ttl?: number;
  }
}

/**
 * A rule object containing conditions and overrides for this load balancer to
 * evaluate.
 */
export interface RulesParam {
  /**
   * The condition expressions to evaluate. If the condition evaluates to true, the
   * overrides or fixed_response in this rule will be applied. An empty condition is
   * always true. For more details on condition expressions, please see
   * https://developers.cloudflare.com/load-balancing/understand-basics/load-balancing-rules/expressions.
   */
  condition?: string;

  /**
   * Disable this specific rule. It will no longer be evaluated by this load
   * balancer.
   */
  disabled?: boolean;

  /**
   * A collection of fields used to directly respond to the eyeball instead of
   * routing to a pool. If a fixed_response is supplied the rule will be marked as
   * terminates.
   */
  fixed_response?: RulesParam.FixedResponse;

  /**
   * Name of this rule. Only used for human readability.
   */
  name?: string;

  /**
   * A collection of overrides to apply to the load balancer when this rule's
   * condition is true. All fields are optional.
   */
  overrides?: RulesParam.Overrides;

  /**
   * The order in which rules should be executed in relation to each other. Lower
   * values are executed first. Values do not need to be sequential. If no value is
   * provided for any rule the array order of the rules field will be used to assign
   * a priority.
   */
  priority?: number;

  /**
   * If this rule's condition is true, this causes rule evaluation to stop after
   * processing this rule.
   */
  terminates?: boolean;
}

export namespace RulesParam {
  /**
   * A collection of fields used to directly respond to the eyeball instead of
   * routing to a pool. If a fixed_response is supplied the rule will be marked as
   * terminates.
   */
  export interface FixedResponse {
    /**
     * The http 'Content-Type' header to include in the response.
     */
    content_type?: string;

    /**
     * The http 'Location' header to include in the response.
     */
    location?: string;

    /**
     * Text to include as the http body.
     */
    message_body?: string;

    /**
     * The http status code to respond with.
     */
    status_code?: number;
  }

  /**
   * A collection of overrides to apply to the load balancer when this rule's
   * condition is true. All fields are optional.
   */
  export interface Overrides {
    /**
     * Controls features that modify the routing of requests to pools and origins in
     * response to dynamic conditions, such as during the interval between active
     * health monitoring requests. For example, zero-downtime failover occurs
     * immediately when an origin becomes unavailable due to HTTP 521, 522, or 523
     * response codes. If there is another healthy origin in the same pool, the request
     * is retried once against this alternate origin.
     */
    adaptive_routing?: LoadBalancersAPI.AdaptiveRoutingParam;

    /**
     * A mapping of country codes to a list of pool IDs (ordered by their failover
     * priority) for the given country. Any country not explicitly defined will fall
     * back to using the corresponding region_pool mapping if it exists else to
     * default_pools.
     */
    country_pools?: { [key: string]: Array<string> };

    /**
     * A list of pool IDs ordered by their failover priority. Pools defined here are
     * used by default, or when region_pools are not configured for a given region.
     */
    default_pools?: Array<LoadBalancersAPI.DefaultPoolsParam>;

    /**
     * The pool ID to use when all other pools are detected as unhealthy.
     */
    fallback_pool?: string;

    /**
     * Controls location-based steering for non-proxied requests. See `steering_policy`
     * to learn how steering is affected.
     */
    location_strategy?: LoadBalancersAPI.LocationStrategyParam;

    /**
     * (Enterprise only): A mapping of Cloudflare PoP identifiers to a list of pool IDs
     * (ordered by their failover priority) for the PoP (datacenter). Any PoPs not
     * explicitly defined will fall back to using the corresponding country_pool, then
     * region_pool mapping if it exists else to default_pools.
     */
    pop_pools?: { [key: string]: Array<string> };

    /**
     * Configures pool weights.
     *
     * - `steering_policy="random"`: A random pool is selected with probability
     *   proportional to pool weights.
     * - `steering_policy="least_outstanding_requests"`: Use pool weights to scale each
     *   pool's outstanding requests.
     * - `steering_policy="least_connections"`: Use pool weights to scale each pool's
     *   open connections.
     */
    random_steering?: LoadBalancersAPI.RandomSteeringParam;

    /**
     * A mapping of region codes to a list of pool IDs (ordered by their failover
     * priority) for the given region. Any regions not explicitly defined will fall
     * back to using default_pools.
     */
    region_pools?: { [key: string]: Array<string> };

    /**
     * Specifies the type of session affinity the load balancer should use unless
     * specified as `"none"`. The supported types are:
     *
     * - `"cookie"`: On the first request to a proxied load balancer, a cookie is
     *   generated, encoding information of which origin the request will be forwarded
     *   to. Subsequent requests, by the same client to the same load balancer, will be
     *   sent to the origin server the cookie encodes, for the duration of the cookie
     *   and as long as the origin server remains healthy. If the cookie has expired or
     *   the origin server is unhealthy, then a new origin server is calculated and
     *   used.
     * - `"ip_cookie"`: Behaves the same as `"cookie"` except the initial origin
     *   selection is stable and based on the client's ip address.
     * - `"header"`: On the first request to a proxied load balancer, a session key
     *   based on the configured HTTP headers (see
     *   `session_affinity_attributes.headers`) is generated, encoding the request
     *   headers used for storing in the load balancer session state which origin the
     *   request will be forwarded to. Subsequent requests to the load balancer with
     *   the same headers will be sent to the same origin server, for the duration of
     *   the session and as long as the origin server remains healthy. If the session
     *   has been idle for the duration of `session_affinity_ttl` seconds or the origin
     *   server is unhealthy, then a new origin server is calculated and used. See
     *   `headers` in `session_affinity_attributes` for additional required
     *   configuration.
     */
    session_affinity?: LoadBalancersAPI.SessionAffinityParam;

    /**
     * Configures attributes for session affinity.
     */
    session_affinity_attributes?: LoadBalancersAPI.SessionAffinityAttributesParam;

    /**
     * Time, in seconds, until a client's session expires after being created. Once the
     * expiry time has been reached, subsequent requests may get sent to a different
     * origin server. The accepted ranges per `session_affinity` policy are:
     *
     * - `"cookie"` / `"ip_cookie"`: The current default of 23 hours will be used
     *   unless explicitly set. The accepted range of values is between [1800, 604800].
     * - `"header"`: The current default of 1800 seconds will be used unless explicitly
     *   set. The accepted range of values is between [30, 3600]. Note: With session
     *   affinity by header, sessions only expire after they haven't been used for the
     *   number of seconds specified.
     */
    session_affinity_ttl?: number;

    /**
     * Steering Policy for this load balancer.
     *
     * - `"off"`: Use `default_pools`.
     * - `"geo"`: Use `region_pools`/`country_pools`/`pop_pools`. For non-proxied
     *   requests, the country for `country_pools` is determined by
     *   `location_strategy`.
     * - `"random"`: Select a pool randomly.
     * - `"dynamic_latency"`: Use round trip time to select the closest pool in
     *   default_pools (requires pool health checks).
     * - `"proximity"`: Use the pools' latitude and longitude to select the closest
     *   pool using the Cloudflare PoP location for proxied requests or the location
     *   determined by `location_strategy` for non-proxied requests.
     * - `"least_outstanding_requests"`: Select a pool by taking into consideration
     *   `random_steering` weights, as well as each pool's number of outstanding
     *   requests. Pools with more pending requests are weighted proportionately less
     *   relative to others.
     * - `"least_connections"`: Select a pool by taking into consideration
     *   `random_steering` weights, as well as each pool's number of open connections.
     *   Pools with more open connections are weighted proportionately less relative to
     *   others. Supported for HTTP/1 and HTTP/2 connections.
     * - `""`: Will map to `"geo"` if you use
     *   `region_pools`/`country_pools`/`pop_pools` otherwise `"off"`.
     */
    steering_policy?: LoadBalancersAPI.SteeringPolicyParam;

    /**
     * Time to live (TTL) of the DNS entry for the IP address returned by this load
     * balancer. This only applies to gray-clouded (unproxied) load balancers.
     */
    ttl?: number;
  }
}

/**
 * Specifies the type of session affinity the load balancer should use unless
 * specified as `"none"`. The supported types are:
 *
 * - `"cookie"`: On the first request to a proxied load balancer, a cookie is
 *   generated, encoding information of which origin the request will be forwarded
 *   to. Subsequent requests, by the same client to the same load balancer, will be
 *   sent to the origin server the cookie encodes, for the duration of the cookie
 *   and as long as the origin server remains healthy. If the cookie has expired or
 *   the origin server is unhealthy, then a new origin server is calculated and
 *   used.
 * - `"ip_cookie"`: Behaves the same as `"cookie"` except the initial origin
 *   selection is stable and based on the client's ip address.
 * - `"header"`: On the first request to a proxied load balancer, a session key
 *   based on the configured HTTP headers (see
 *   `session_affinity_attributes.headers`) is generated, encoding the request
 *   headers used for storing in the load balancer session state which origin the
 *   request will be forwarded to. Subsequent requests to the load balancer with
 *   the same headers will be sent to the same origin server, for the duration of
 *   the session and as long as the origin server remains healthy. If the session
 *   has been idle for the duration of `session_affinity_ttl` seconds or the origin
 *   server is unhealthy, then a new origin server is calculated and used. See
 *   `headers` in `session_affinity_attributes` for additional required
 *   configuration.
 */
export type SessionAffinity = 'none' | 'cookie' | 'ip_cookie' | 'header';

/**
 * Specifies the type of session affinity the load balancer should use unless
 * specified as `"none"`. The supported types are:
 *
 * - `"cookie"`: On the first request to a proxied load balancer, a cookie is
 *   generated, encoding information of which origin the request will be forwarded
 *   to. Subsequent requests, by the same client to the same load balancer, will be
 *   sent to the origin server the cookie encodes, for the duration of the cookie
 *   and as long as the origin server remains healthy. If the cookie has expired or
 *   the origin server is unhealthy, then a new origin server is calculated and
 *   used.
 * - `"ip_cookie"`: Behaves the same as `"cookie"` except the initial origin
 *   selection is stable and based on the client's ip address.
 * - `"header"`: On the first request to a proxied load balancer, a session key
 *   based on the configured HTTP headers (see
 *   `session_affinity_attributes.headers`) is generated, encoding the request
 *   headers used for storing in the load balancer session state which origin the
 *   request will be forwarded to. Subsequent requests to the load balancer with
 *   the same headers will be sent to the same origin server, for the duration of
 *   the session and as long as the origin server remains healthy. If the session
 *   has been idle for the duration of `session_affinity_ttl` seconds or the origin
 *   server is unhealthy, then a new origin server is calculated and used. See
 *   `headers` in `session_affinity_attributes` for additional required
 *   configuration.
 */
export type SessionAffinityParam = 'none' | 'cookie' | 'ip_cookie' | 'header';

/**
 * Configures attributes for session affinity.
 */
export interface SessionAffinityAttributes {
  /**
   * Configures the drain duration in seconds. This field is only used when session
   * affinity is enabled on the load balancer.
   */
  drain_duration?: number;

  /**
   * Configures the names of HTTP headers to base session affinity on when header
   * `session_affinity` is enabled. At least one HTTP header name must be provided.
   * To specify the exact cookies to be used, include an item in the following
   * format: `"cookie:<cookie-name-1>,<cookie-name-2>"` (example) where everything
   * after the colon is a comma-separated list of cookie names. Providing only
   * `"cookie"` will result in all cookies being used. The default max number of HTTP
   * header names that can be provided depends on your plan: 5 for Enterprise, 1 for
   * all other plans.
   */
  headers?: Array<string>;

  /**
   * When header `session_affinity` is enabled, this option can be used to specify
   * how HTTP headers on load balancing requests will be used. The supported values
   * are:
   *
   * - `"true"`: Load balancing requests must contain _all_ of the HTTP headers
   *   specified by the `headers` session affinity attribute, otherwise sessions
   *   aren't created.
   * - `"false"`: Load balancing requests must contain _at least one_ of the HTTP
   *   headers specified by the `headers` session affinity attribute, otherwise
   *   sessions aren't created.
   */
  require_all_headers?: boolean;

  /**
   * Configures the SameSite attribute on session affinity cookie. Value "Auto" will
   * be translated to "Lax" or "None" depending if Always Use HTTPS is enabled. Note:
   * when using value "None", the secure attribute can not be set to "Never".
   */
  samesite?: 'Auto' | 'Lax' | 'None' | 'Strict';

  /**
   * Configures the Secure attribute on session affinity cookie. Value "Always"
   * indicates the Secure attribute will be set in the Set-Cookie header, "Never"
   * indicates the Secure attribute will not be set, and "Auto" will set the Secure
   * attribute depending if Always Use HTTPS is enabled.
   */
  secure?: 'Auto' | 'Always' | 'Never';

  /**
   * Configures the zero-downtime failover between origins within a pool when session
   * affinity is enabled. This feature is currently incompatible with Argo, Tiered
   * Cache, and Bandwidth Alliance. The supported values are:
   *
   * - `"none"`: No failover takes place for sessions pinned to the origin (default).
   * - `"temporary"`: Traffic will be sent to another other healthy origin until the
   *   originally pinned origin is available; note that this can potentially result
   *   in heavy origin flapping.
   * - `"sticky"`: The session affinity cookie is updated and subsequent requests are
   *   sent to the new origin. Note: Zero-downtime failover with sticky sessions is
   *   currently not supported for session affinity by header.
   */
  zero_downtime_failover?: 'none' | 'temporary' | 'sticky';
}

/**
 * Configures attributes for session affinity.
 */
export interface SessionAffinityAttributesParam {
  /**
   * Configures the drain duration in seconds. This field is only used when session
   * affinity is enabled on the load balancer.
   */
  drain_duration?: number;

  /**
   * Configures the names of HTTP headers to base session affinity on when header
   * `session_affinity` is enabled. At least one HTTP header name must be provided.
   * To specify the exact cookies to be used, include an item in the following
   * format: `"cookie:<cookie-name-1>,<cookie-name-2>"` (example) where everything
   * after the colon is a comma-separated list of cookie names. Providing only
   * `"cookie"` will result in all cookies being used. The default max number of HTTP
   * header names that can be provided depends on your plan: 5 for Enterprise, 1 for
   * all other plans.
   */
  headers?: Array<string>;

  /**
   * When header `session_affinity` is enabled, this option can be used to specify
   * how HTTP headers on load balancing requests will be used. The supported values
   * are:
   *
   * - `"true"`: Load balancing requests must contain _all_ of the HTTP headers
   *   specified by the `headers` session affinity attribute, otherwise sessions
   *   aren't created.
   * - `"false"`: Load balancing requests must contain _at least one_ of the HTTP
   *   headers specified by the `headers` session affinity attribute, otherwise
   *   sessions aren't created.
   */
  require_all_headers?: boolean;

  /**
   * Configures the SameSite attribute on session affinity cookie. Value "Auto" will
   * be translated to "Lax" or "None" depending if Always Use HTTPS is enabled. Note:
   * when using value "None", the secure attribute can not be set to "Never".
   */
  samesite?: 'Auto' | 'Lax' | 'None' | 'Strict';

  /**
   * Configures the Secure attribute on session affinity cookie. Value "Always"
   * indicates the Secure attribute will be set in the Set-Cookie header, "Never"
   * indicates the Secure attribute will not be set, and "Auto" will set the Secure
   * attribute depending if Always Use HTTPS is enabled.
   */
  secure?: 'Auto' | 'Always' | 'Never';

  /**
   * Configures the zero-downtime failover between origins within a pool when session
   * affinity is enabled. This feature is currently incompatible with Argo, Tiered
   * Cache, and Bandwidth Alliance. The supported values are:
   *
   * - `"none"`: No failover takes place for sessions pinned to the origin (default).
   * - `"temporary"`: Traffic will be sent to another other healthy origin until the
   *   originally pinned origin is available; note that this can potentially result
   *   in heavy origin flapping.
   * - `"sticky"`: The session affinity cookie is updated and subsequent requests are
   *   sent to the new origin. Note: Zero-downtime failover with sticky sessions is
   *   currently not supported for session affinity by header.
   */
  zero_downtime_failover?: 'none' | 'temporary' | 'sticky';
}

/**
 * Steering Policy for this load balancer.
 *
 * - `"off"`: Use `default_pools`.
 * - `"geo"`: Use `region_pools`/`country_pools`/`pop_pools`. For non-proxied
 *   requests, the country for `country_pools` is determined by
 *   `location_strategy`.
 * - `"random"`: Select a pool randomly.
 * - `"dynamic_latency"`: Use round trip time to select the closest pool in
 *   default_pools (requires pool health checks).
 * - `"proximity"`: Use the pools' latitude and longitude to select the closest
 *   pool using the Cloudflare PoP location for proxied requests or the location
 *   determined by `location_strategy` for non-proxied requests.
 * - `"least_outstanding_requests"`: Select a pool by taking into consideration
 *   `random_steering` weights, as well as each pool's number of outstanding
 *   requests. Pools with more pending requests are weighted proportionately less
 *   relative to others.
 * - `"least_connections"`: Select a pool by taking into consideration
 *   `random_steering` weights, as well as each pool's number of open connections.
 *   Pools with more open connections are weighted proportionately less relative to
 *   others. Supported for HTTP/1 and HTTP/2 connections.
 * - `""`: Will map to `"geo"` if you use
 *   `region_pools`/`country_pools`/`pop_pools` otherwise `"off"`.
 */
export type SteeringPolicy =
  | 'off'
  | 'geo'
  | 'random'
  | 'dynamic_latency'
  | 'proximity'
  | 'least_outstanding_requests'
  | 'least_connections'
  | '';

/**
 * Steering Policy for this load balancer.
 *
 * - `"off"`: Use `default_pools`.
 * - `"geo"`: Use `region_pools`/`country_pools`/`pop_pools`. For non-proxied
 *   requests, the country for `country_pools` is determined by
 *   `location_strategy`.
 * - `"random"`: Select a pool randomly.
 * - `"dynamic_latency"`: Use round trip time to select the closest pool in
 *   default_pools (requires pool health checks).
 * - `"proximity"`: Use the pools' latitude and longitude to select the closest
 *   pool using the Cloudflare PoP location for proxied requests or the location
 *   determined by `location_strategy` for non-proxied requests.
 * - `"least_outstanding_requests"`: Select a pool by taking into consideration
 *   `random_steering` weights, as well as each pool's number of outstanding
 *   requests. Pools with more pending requests are weighted proportionately less
 *   relative to others.
 * - `"least_connections"`: Select a pool by taking into consideration
 *   `random_steering` weights, as well as each pool's number of open connections.
 *   Pools with more open connections are weighted proportionately less relative to
 *   others. Supported for HTTP/1 and HTTP/2 connections.
 * - `""`: Will map to `"geo"` if you use
 *   `region_pools`/`country_pools`/`pop_pools` otherwise `"off"`.
 */
export type SteeringPolicyParam =
  | 'off'
  | 'geo'
  | 'random'
  | 'dynamic_latency'
  | 'proximity'
  | 'least_outstanding_requests'
  | 'least_connections'
  | '';

export interface LoadBalancerDeleteResponse {
  id?: string;
}

export interface LoadBalancerCreateParams {
  /**
   * Path param:
   */
  zone_id: string;

  /**
   * Body param: A list of pool IDs ordered by their failover priority. Pools defined
   * here are used by default, or when region_pools are not configured for a given
   * region.
   */
  default_pools: Array<DefaultPoolsParam>;

  /**
   * Body param: The pool ID to use when all other pools are detected as unhealthy.
   */
  fallback_pool: string;

  /**
   * Body param: The DNS hostname to associate with your Load Balancer. If this
   * hostname already exists as a DNS record in Cloudflare's DNS, the Load Balancer
   * will take precedence and the DNS record will not be used.
   */
  name: string;

  /**
   * Body param: Controls features that modify the routing of requests to pools and
   * origins in response to dynamic conditions, such as during the interval between
   * active health monitoring requests. For example, zero-downtime failover occurs
   * immediately when an origin becomes unavailable due to HTTP 521, 522, or 523
   * response codes. If there is another healthy origin in the same pool, the request
   * is retried once against this alternate origin.
   */
  adaptive_routing?: AdaptiveRoutingParam;

  /**
   * Body param: A mapping of country codes to a list of pool IDs (ordered by their
   * failover priority) for the given country. Any country not explicitly defined
   * will fall back to using the corresponding region_pool mapping if it exists else
   * to default_pools.
   */
  country_pools?: { [key: string]: Array<string> };

  /**
   * Body param: Object description.
   */
  description?: string;

  /**
   * Body param: Controls location-based steering for non-proxied requests. See
   * `steering_policy` to learn how steering is affected.
   */
  location_strategy?: LocationStrategyParam;

  /**
   * Body param: List of networks where Load Balancer or Pool is enabled.
   */
  networks?: Array<string>;

  /**
   * Body param: (Enterprise only): A mapping of Cloudflare PoP identifiers to a list
   * of pool IDs (ordered by their failover priority) for the PoP (datacenter). Any
   * PoPs not explicitly defined will fall back to using the corresponding
   * country_pool, then region_pool mapping if it exists else to default_pools.
   */
  pop_pools?: { [key: string]: Array<string> };

  /**
   * Body param: Whether the hostname should be gray clouded (false) or orange
   * clouded (true).
   */
  proxied?: boolean;

  /**
   * Body param: Configures pool weights.
   *
   * - `steering_policy="random"`: A random pool is selected with probability
   *   proportional to pool weights.
   * - `steering_policy="least_outstanding_requests"`: Use pool weights to scale each
   *   pool's outstanding requests.
   * - `steering_policy="least_connections"`: Use pool weights to scale each pool's
   *   open connections.
   */
  random_steering?: RandomSteeringParam;

  /**
   * Body param: A mapping of region codes to a list of pool IDs (ordered by their
   * failover priority) for the given region. Any regions not explicitly defined will
   * fall back to using default_pools.
   */
  region_pools?: { [key: string]: Array<string> };

  /**
   * Body param: BETA Field Not General Access: A list of rules for this load
   * balancer to execute.
   */
  rules?: Array<RulesParam>;

  /**
   * Body param: Specifies the type of session affinity the load balancer should use
   * unless specified as `"none"`. The supported types are:
   *
   * - `"cookie"`: On the first request to a proxied load balancer, a cookie is
   *   generated, encoding information of which origin the request will be forwarded
   *   to. Subsequent requests, by the same client to the same load balancer, will be
   *   sent to the origin server the cookie encodes, for the duration of the cookie
   *   and as long as the origin server remains healthy. If the cookie has expired or
   *   the origin server is unhealthy, then a new origin server is calculated and
   *   used.
   * - `"ip_cookie"`: Behaves the same as `"cookie"` except the initial origin
   *   selection is stable and based on the client's ip address.
   * - `"header"`: On the first request to a proxied load balancer, a session key
   *   based on the configured HTTP headers (see
   *   `session_affinity_attributes.headers`) is generated, encoding the request
   *   headers used for storing in the load balancer session state which origin the
   *   request will be forwarded to. Subsequent requests to the load balancer with
   *   the same headers will be sent to the same origin server, for the duration of
   *   the session and as long as the origin server remains healthy. If the session
   *   has been idle for the duration of `session_affinity_ttl` seconds or the origin
   *   server is unhealthy, then a new origin server is calculated and used. See
   *   `headers` in `session_affinity_attributes` for additional required
   *   configuration.
   */
  session_affinity?: SessionAffinityParam;

  /**
   * Body param: Configures attributes for session affinity.
   */
  session_affinity_attributes?: SessionAffinityAttributesParam;

  /**
   * Body param: Time, in seconds, until a client's session expires after being
   * created. Once the expiry time has been reached, subsequent requests may get sent
   * to a different origin server. The accepted ranges per `session_affinity` policy
   * are:
   *
   * - `"cookie"` / `"ip_cookie"`: The current default of 23 hours will be used
   *   unless explicitly set. The accepted range of values is between [1800, 604800].
   * - `"header"`: The current default of 1800 seconds will be used unless explicitly
   *   set. The accepted range of values is between [30, 3600]. Note: With session
   *   affinity by header, sessions only expire after they haven't been used for the
   *   number of seconds specified.
   */
  session_affinity_ttl?: number;

  /**
   * Body param: Steering Policy for this load balancer.
   *
   * - `"off"`: Use `default_pools`.
   * - `"geo"`: Use `region_pools`/`country_pools`/`pop_pools`. For non-proxied
   *   requests, the country for `country_pools` is determined by
   *   `location_strategy`.
   * - `"random"`: Select a pool randomly.
   * - `"dynamic_latency"`: Use round trip time to select the closest pool in
   *   default_pools (requires pool health checks).
   * - `"proximity"`: Use the pools' latitude and longitude to select the closest
   *   pool using the Cloudflare PoP location for proxied requests or the location
   *   determined by `location_strategy` for non-proxied requests.
   * - `"least_outstanding_requests"`: Select a pool by taking into consideration
   *   `random_steering` weights, as well as each pool's number of outstanding
   *   requests. Pools with more pending requests are weighted proportionately less
   *   relative to others.
   * - `"least_connections"`: Select a pool by taking into consideration
   *   `random_steering` weights, as well as each pool's number of open connections.
   *   Pools with more open connections are weighted proportionately less relative to
   *   others. Supported for HTTP/1 and HTTP/2 connections.
   * - `""`: Will map to `"geo"` if you use
   *   `region_pools`/`country_pools`/`pop_pools` otherwise `"off"`.
   */
  steering_policy?: SteeringPolicyParam;

  /**
   * Body param: Time to live (TTL) of the DNS entry for the IP address returned by
   * this load balancer. This only applies to gray-clouded (unproxied) load
   * balancers.
   */
  ttl?: number;
}

export interface LoadBalancerUpdateParams {
  /**
   * Path param:
   */
  zone_id: string;

  /**
   * Body param: A list of pool IDs ordered by their failover priority. Pools defined
   * here are used by default, or when region_pools are not configured for a given
   * region.
   */
  default_pools: Array<DefaultPoolsParam>;

  /**
   * Body param: The pool ID to use when all other pools are detected as unhealthy.
   */
  fallback_pool: string;

  /**
   * Body param: The DNS hostname to associate with your Load Balancer. If this
   * hostname already exists as a DNS record in Cloudflare's DNS, the Load Balancer
   * will take precedence and the DNS record will not be used.
   */
  name: string;

  /**
   * Body param: Controls features that modify the routing of requests to pools and
   * origins in response to dynamic conditions, such as during the interval between
   * active health monitoring requests. For example, zero-downtime failover occurs
   * immediately when an origin becomes unavailable due to HTTP 521, 522, or 523
   * response codes. If there is another healthy origin in the same pool, the request
   * is retried once against this alternate origin.
   */
  adaptive_routing?: AdaptiveRoutingParam;

  /**
   * Body param: A mapping of country codes to a list of pool IDs (ordered by their
   * failover priority) for the given country. Any country not explicitly defined
   * will fall back to using the corresponding region_pool mapping if it exists else
   * to default_pools.
   */
  country_pools?: { [key: string]: Array<string> };

  /**
   * Body param: Object description.
   */
  description?: string;

  /**
   * Body param: Whether to enable (the default) this load balancer.
   */
  enabled?: boolean;

  /**
   * Body param: Controls location-based steering for non-proxied requests. See
   * `steering_policy` to learn how steering is affected.
   */
  location_strategy?: LocationStrategyParam;

  /**
   * Body param: List of networks where Load Balancer or Pool is enabled.
   */
  networks?: Array<string>;

  /**
   * Body param: (Enterprise only): A mapping of Cloudflare PoP identifiers to a list
   * of pool IDs (ordered by their failover priority) for the PoP (datacenter). Any
   * PoPs not explicitly defined will fall back to using the corresponding
   * country_pool, then region_pool mapping if it exists else to default_pools.
   */
  pop_pools?: { [key: string]: Array<string> };

  /**
   * Body param: Whether the hostname should be gray clouded (false) or orange
   * clouded (true).
   */
  proxied?: boolean;

  /**
   * Body param: Configures pool weights.
   *
   * - `steering_policy="random"`: A random pool is selected with probability
   *   proportional to pool weights.
   * - `steering_policy="least_outstanding_requests"`: Use pool weights to scale each
   *   pool's outstanding requests.
   * - `steering_policy="least_connections"`: Use pool weights to scale each pool's
   *   open connections.
   */
  random_steering?: RandomSteeringParam;

  /**
   * Body param: A mapping of region codes to a list of pool IDs (ordered by their
   * failover priority) for the given region. Any regions not explicitly defined will
   * fall back to using default_pools.
   */
  region_pools?: { [key: string]: Array<string> };

  /**
   * Body param: BETA Field Not General Access: A list of rules for this load
   * balancer to execute.
   */
  rules?: Array<RulesParam>;

  /**
   * Body param: Specifies the type of session affinity the load balancer should use
   * unless specified as `"none"`. The supported types are:
   *
   * - `"cookie"`: On the first request to a proxied load balancer, a cookie is
   *   generated, encoding information of which origin the request will be forwarded
   *   to. Subsequent requests, by the same client to the same load balancer, will be
   *   sent to the origin server the cookie encodes, for the duration of the cookie
   *   and as long as the origin server remains healthy. If the cookie has expired or
   *   the origin server is unhealthy, then a new origin server is calculated and
   *   used.
   * - `"ip_cookie"`: Behaves the same as `"cookie"` except the initial origin
   *   selection is stable and based on the client's ip address.
   * - `"header"`: On the first request to a proxied load balancer, a session key
   *   based on the configured HTTP headers (see
   *   `session_affinity_attributes.headers`) is generated, encoding the request
   *   headers used for storing in the load balancer session state which origin the
   *   request will be forwarded to. Subsequent requests to the load balancer with
   *   the same headers will be sent to the same origin server, for the duration of
   *   the session and as long as the origin server remains healthy. If the session
   *   has been idle for the duration of `session_affinity_ttl` seconds or the origin
   *   server is unhealthy, then a new origin server is calculated and used. See
   *   `headers` in `session_affinity_attributes` for additional required
   *   configuration.
   */
  session_affinity?: SessionAffinityParam;

  /**
   * Body param: Configures attributes for session affinity.
   */
  session_affinity_attributes?: SessionAffinityAttributesParam;

  /**
   * Body param: Time, in seconds, until a client's session expires after being
   * created. Once the expiry time has been reached, subsequent requests may get sent
   * to a different origin server. The accepted ranges per `session_affinity` policy
   * are:
   *
   * - `"cookie"` / `"ip_cookie"`: The current default of 23 hours will be used
   *   unless explicitly set. The accepted range of values is between [1800, 604800].
   * - `"header"`: The current default of 1800 seconds will be used unless explicitly
   *   set. The accepted range of values is between [30, 3600]. Note: With session
   *   affinity by header, sessions only expire after they haven't been used for the
   *   number of seconds specified.
   */
  session_affinity_ttl?: number;

  /**
   * Body param: Steering Policy for this load balancer.
   *
   * - `"off"`: Use `default_pools`.
   * - `"geo"`: Use `region_pools`/`country_pools`/`pop_pools`. For non-proxied
   *   requests, the country for `country_pools` is determined by
   *   `location_strategy`.
   * - `"random"`: Select a pool randomly.
   * - `"dynamic_latency"`: Use round trip time to select the closest pool in
   *   default_pools (requires pool health checks).
   * - `"proximity"`: Use the pools' latitude and longitude to select the closest
   *   pool using the Cloudflare PoP location for proxied requests or the location
   *   determined by `location_strategy` for non-proxied requests.
   * - `"least_outstanding_requests"`: Select a pool by taking into consideration
   *   `random_steering` weights, as well as each pool's number of outstanding
   *   requests. Pools with more pending requests are weighted proportionately less
   *   relative to others.
   * - `"least_connections"`: Select a pool by taking into consideration
   *   `random_steering` weights, as well as each pool's number of open connections.
   *   Pools with more open connections are weighted proportionately less relative to
   *   others. Supported for HTTP/1 and HTTP/2 connections.
   * - `""`: Will map to `"geo"` if you use
   *   `region_pools`/`country_pools`/`pop_pools` otherwise `"off"`.
   */
  steering_policy?: SteeringPolicyParam;

  /**
   * Body param: Time to live (TTL) of the DNS entry for the IP address returned by
   * this load balancer. This only applies to gray-clouded (unproxied) load
   * balancers.
   */
  ttl?: number;
}

export interface LoadBalancerListParams {
  zone_id: string;
}

export interface LoadBalancerDeleteParams {
  zone_id: string;
}

export interface LoadBalancerEditParams {
  /**
   * Path param:
   */
  zone_id: string;

  /**
   * Body param: Controls features that modify the routing of requests to pools and
   * origins in response to dynamic conditions, such as during the interval between
   * active health monitoring requests. For example, zero-downtime failover occurs
   * immediately when an origin becomes unavailable due to HTTP 521, 522, or 523
   * response codes. If there is another healthy origin in the same pool, the request
   * is retried once against this alternate origin.
   */
  adaptive_routing?: AdaptiveRoutingParam;

  /**
   * Body param: A mapping of country codes to a list of pool IDs (ordered by their
   * failover priority) for the given country. Any country not explicitly defined
   * will fall back to using the corresponding region_pool mapping if it exists else
   * to default_pools.
   */
  country_pools?: { [key: string]: Array<string> };

  /**
   * Body param: A list of pool IDs ordered by their failover priority. Pools defined
   * here are used by default, or when region_pools are not configured for a given
   * region.
   */
  default_pools?: Array<DefaultPoolsParam>;

  /**
   * Body param: Object description.
   */
  description?: string;

  /**
   * Body param: Whether to enable (the default) this load balancer.
   */
  enabled?: boolean;

  /**
   * Body param: The pool ID to use when all other pools are detected as unhealthy.
   */
  fallback_pool?: string;

  /**
   * Body param: Controls location-based steering for non-proxied requests. See
   * `steering_policy` to learn how steering is affected.
   */
  location_strategy?: LocationStrategyParam;

  /**
   * Body param: The DNS hostname to associate with your Load Balancer. If this
   * hostname already exists as a DNS record in Cloudflare's DNS, the Load Balancer
   * will take precedence and the DNS record will not be used.
   */
  name?: string;

  /**
   * Body param: (Enterprise only): A mapping of Cloudflare PoP identifiers to a list
   * of pool IDs (ordered by their failover priority) for the PoP (datacenter). Any
   * PoPs not explicitly defined will fall back to using the corresponding
   * country_pool, then region_pool mapping if it exists else to default_pools.
   */
  pop_pools?: { [key: string]: Array<string> };

  /**
   * Body param: Whether the hostname should be gray clouded (false) or orange
   * clouded (true).
   */
  proxied?: boolean;

  /**
   * Body param: Configures pool weights.
   *
   * - `steering_policy="random"`: A random pool is selected with probability
   *   proportional to pool weights.
   * - `steering_policy="least_outstanding_requests"`: Use pool weights to scale each
   *   pool's outstanding requests.
   * - `steering_policy="least_connections"`: Use pool weights to scale each pool's
   *   open connections.
   */
  random_steering?: RandomSteeringParam;

  /**
   * Body param: A mapping of region codes to a list of pool IDs (ordered by their
   * failover priority) for the given region. Any regions not explicitly defined will
   * fall back to using default_pools.
   */
  region_pools?: { [key: string]: Array<string> };

  /**
   * Body param: BETA Field Not General Access: A list of rules for this load
   * balancer to execute.
   */
  rules?: Array<RulesParam>;

  /**
   * Body param: Specifies the type of session affinity the load balancer should use
   * unless specified as `"none"`. The supported types are:
   *
   * - `"cookie"`: On the first request to a proxied load balancer, a cookie is
   *   generated, encoding information of which origin the request will be forwarded
   *   to. Subsequent requests, by the same client to the same load balancer, will be
   *   sent to the origin server the cookie encodes, for the duration of the cookie
   *   and as long as the origin server remains healthy. If the cookie has expired or
   *   the origin server is unhealthy, then a new origin server is calculated and
   *   used.
   * - `"ip_cookie"`: Behaves the same as `"cookie"` except the initial origin
   *   selection is stable and based on the client's ip address.
   * - `"header"`: On the first request to a proxied load balancer, a session key
   *   based on the configured HTTP headers (see
   *   `session_affinity_attributes.headers`) is generated, encoding the request
   *   headers used for storing in the load balancer session state which origin the
   *   request will be forwarded to. Subsequent requests to the load balancer with
   *   the same headers will be sent to the same origin server, for the duration of
   *   the session and as long as the origin server remains healthy. If the session
   *   has been idle for the duration of `session_affinity_ttl` seconds or the origin
   *   server is unhealthy, then a new origin server is calculated and used. See
   *   `headers` in `session_affinity_attributes` for additional required
   *   configuration.
   */
  session_affinity?: SessionAffinityParam;

  /**
   * Body param: Configures attributes for session affinity.
   */
  session_affinity_attributes?: SessionAffinityAttributesParam;

  /**
   * Body param: Time, in seconds, until a client's session expires after being
   * created. Once the expiry time has been reached, subsequent requests may get sent
   * to a different origin server. The accepted ranges per `session_affinity` policy
   * are:
   *
   * - `"cookie"` / `"ip_cookie"`: The current default of 23 hours will be used
   *   unless explicitly set. The accepted range of values is between [1800, 604800].
   * - `"header"`: The current default of 1800 seconds will be used unless explicitly
   *   set. The accepted range of values is between [30, 3600]. Note: With session
   *   affinity by header, sessions only expire after they haven't been used for the
   *   number of seconds specified.
   */
  session_affinity_ttl?: number;

  /**
   * Body param: Steering Policy for this load balancer.
   *
   * - `"off"`: Use `default_pools`.
   * - `"geo"`: Use `region_pools`/`country_pools`/`pop_pools`. For non-proxied
   *   requests, the country for `country_pools` is determined by
   *   `location_strategy`.
   * - `"random"`: Select a pool randomly.
   * - `"dynamic_latency"`: Use round trip time to select the closest pool in
   *   default_pools (requires pool health checks).
   * - `"proximity"`: Use the pools' latitude and longitude to select the closest
   *   pool using the Cloudflare PoP location for proxied requests or the location
   *   determined by `location_strategy` for non-proxied requests.
   * - `"least_outstanding_requests"`: Select a pool by taking into consideration
   *   `random_steering` weights, as well as each pool's number of outstanding
   *   requests. Pools with more pending requests are weighted proportionately less
   *   relative to others.
   * - `"least_connections"`: Select a pool by taking into consideration
   *   `random_steering` weights, as well as each pool's number of open connections.
   *   Pools with more open connections are weighted proportionately less relative to
   *   others. Supported for HTTP/1 and HTTP/2 connections.
   * - `""`: Will map to `"geo"` if you use
   *   `region_pools`/`country_pools`/`pop_pools` otherwise `"off"`.
   */
  steering_policy?: SteeringPolicyParam;

  /**
   * Body param: Time to live (TTL) of the DNS entry for the IP address returned by
   * this load balancer. This only applies to gray-clouded (unproxied) load
   * balancers.
   */
  ttl?: number;
}

export interface LoadBalancerGetParams {
  zone_id: string;
}

LoadBalancers.LoadBalancersSinglePage = LoadBalancersSinglePage;
LoadBalancers.Monitors = Monitors;
LoadBalancers.MonitorsSinglePage = MonitorsSinglePage;
LoadBalancers.Pools = Pools;
LoadBalancers.PoolsSinglePage = PoolsSinglePage;
LoadBalancers.Previews = Previews;
LoadBalancers.Regions = Regions;
LoadBalancers.Searches = Searches;
LoadBalancers.SearchListResponsesV4PagePagination = SearchListResponsesV4PagePagination;

export declare namespace LoadBalancers {
  export {
    type AdaptiveRouting as AdaptiveRouting,
    type CheckRegion as CheckRegion,
    type DefaultPools as DefaultPools,
    type FilterOptions as FilterOptions,
    type Header as Header,
    type Host as Host,
    type LoadBalancer as LoadBalancer,
    type LoadShedding as LoadShedding,
    type LocationStrategy as LocationStrategy,
    type NotificationFilter as NotificationFilter,
    type Origin as Origin,
    type OriginSteering as OriginSteering,
    type RandomSteering as RandomSteering,
    type Rules as Rules,
    type SessionAffinity as SessionAffinity,
    type SessionAffinityAttributes as SessionAffinityAttributes,
    type SteeringPolicy as SteeringPolicy,
    type LoadBalancerDeleteResponse as LoadBalancerDeleteResponse,
    LoadBalancersSinglePage as LoadBalancersSinglePage,
    type LoadBalancerCreateParams as LoadBalancerCreateParams,
    type LoadBalancerUpdateParams as LoadBalancerUpdateParams,
    type LoadBalancerListParams as LoadBalancerListParams,
    type LoadBalancerDeleteParams as LoadBalancerDeleteParams,
    type LoadBalancerEditParams as LoadBalancerEditParams,
    type LoadBalancerGetParams as LoadBalancerGetParams,
  };

  export {
    Monitors as Monitors,
    type Monitor as Monitor,
    type MonitorDeleteResponse as MonitorDeleteResponse,
    MonitorsSinglePage as MonitorsSinglePage,
    type MonitorCreateParams as MonitorCreateParams,
    type MonitorUpdateParams as MonitorUpdateParams,
    type MonitorListParams as MonitorListParams,
    type MonitorDeleteParams as MonitorDeleteParams,
    type MonitorEditParams as MonitorEditParams,
    type MonitorGetParams as MonitorGetParams,
  };

  export {
    Pools as Pools,
    type Pool as Pool,
    type PoolDeleteResponse as PoolDeleteResponse,
    PoolsSinglePage as PoolsSinglePage,
    type PoolCreateParams as PoolCreateParams,
    type PoolUpdateParams as PoolUpdateParams,
    type PoolListParams as PoolListParams,
    type PoolDeleteParams as PoolDeleteParams,
    type PoolBulkEditParams as PoolBulkEditParams,
    type PoolEditParams as PoolEditParams,
    type PoolGetParams as PoolGetParams,
  };

  export {
    Previews as Previews,
    type PreviewGetResponse as PreviewGetResponse,
    type PreviewGetParams as PreviewGetParams,
  };

  export {
    Regions as Regions,
    type RegionListResponse as RegionListResponse,
    type RegionGetResponse as RegionGetResponse,
    type RegionListParams as RegionListParams,
    type RegionGetParams as RegionGetParams,
  };

  export {
    Searches as Searches,
    type SearchListResponse as SearchListResponse,
    SearchListResponsesV4PagePagination as SearchListResponsesV4PagePagination,
    type SearchListParams as SearchListParams,
  };
}
