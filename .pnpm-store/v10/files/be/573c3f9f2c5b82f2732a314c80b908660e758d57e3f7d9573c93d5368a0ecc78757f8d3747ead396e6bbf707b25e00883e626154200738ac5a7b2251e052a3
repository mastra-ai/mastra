import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as LoadBalancersAPI from "../load-balancers.js";
import * as HealthAPI from "./health.js";
import { Health, HealthCreateParams, HealthCreateResponse, HealthGetParams, HealthGetResponse } from "./health.js";
import * as ReferencesAPI from "./references.js";
import { ReferenceGetParams, ReferenceGetResponse, ReferenceGetResponsesSinglePage, References } from "./references.js";
import { SinglePage } from "../../../pagination.js";
export declare class Pools extends APIResource {
    health: HealthAPI.Health;
    references: ReferencesAPI.References;
    /**
     * Create a new pool.
     *
     * @example
     * ```ts
     * const pool = await client.loadBalancers.pools.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'primary-dc-1',
     *   origins: [{}],
     * });
     * ```
     */
    create(params: PoolCreateParams, options?: Core.RequestOptions): Core.APIPromise<Pool>;
    /**
     * Modify a configured pool.
     *
     * @example
     * ```ts
     * const pool = await client.loadBalancers.pools.update(
     *   '17b5962d775c646f3f9725cbc7a53df4',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     name: 'primary-dc-1',
     *     origins: [{}],
     *   },
     * );
     * ```
     */
    update(poolId: string, params: PoolUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Pool>;
    /**
     * List configured pools.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const pool of client.loadBalancers.pools.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params: PoolListParams, options?: Core.RequestOptions): Core.PagePromise<PoolsSinglePage, Pool>;
    /**
     * Delete a configured pool.
     *
     * @example
     * ```ts
     * const pool = await client.loadBalancers.pools.delete(
     *   '17b5962d775c646f3f9725cbc7a53df4',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(poolId: string, params: PoolDeleteParams, options?: Core.RequestOptions): Core.APIPromise<PoolDeleteResponse>;
    /**
     * Apply changes to a number of existing pools, overwriting the supplied
     * properties. Pools are ordered by ascending `name`. Returns the list of affected
     * pools. Supports the standard pagination query parameters, either
     * `limit`/`offset` or `per_page`/`page`.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const pool of client.loadBalancers.pools.bulkEdit(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    bulkEdit(params: PoolBulkEditParams, options?: Core.RequestOptions): Core.PagePromise<PoolsSinglePage, Pool>;
    /**
     * Apply changes to an existing pool, overwriting the supplied properties.
     *
     * @example
     * ```ts
     * const pool = await client.loadBalancers.pools.edit(
     *   '17b5962d775c646f3f9725cbc7a53df4',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(poolId: string, params: PoolEditParams, options?: Core.RequestOptions): Core.APIPromise<Pool>;
    /**
     * Fetch a single configured pool.
     *
     * @example
     * ```ts
     * const pool = await client.loadBalancers.pools.get(
     *   '17b5962d775c646f3f9725cbc7a53df4',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(poolId: string, params: PoolGetParams, options?: Core.RequestOptions): Core.APIPromise<Pool>;
}
export declare class PoolsSinglePage extends SinglePage<Pool> {
}
export interface Pool {
    id?: string;
    /**
     * A list of regions from which to run health checks. Null means every Cloudflare
     * data center.
     */
    check_regions?: Array<LoadBalancersAPI.CheckRegion> | null;
    created_on?: string;
    /**
     * A human-readable description of the pool.
     */
    description?: string;
    /**
     * This field shows up only if the pool is disabled. This field is set with the
     * time the pool was disabled at.
     */
    disabled_at?: string;
    /**
     * Whether to enable (the default) or disable this pool. Disabled pools will not
     * receive traffic and are excluded from health checks. Disabling a pool will cause
     * any load balancers using it to failover to the next pool (if any).
     */
    enabled?: boolean;
    /**
     * The latitude of the data center containing the origins used in this pool in
     * decimal degrees. If this is set, longitude must also be set.
     */
    latitude?: number;
    /**
     * Configures load shedding policies and percentages for the pool.
     */
    load_shedding?: LoadBalancersAPI.LoadShedding;
    /**
     * The longitude of the data center containing the origins used in this pool in
     * decimal degrees. If this is set, latitude must also be set.
     */
    longitude?: number;
    /**
     * The minimum number of origins that must be healthy for this pool to serve
     * traffic. If the number of healthy origins falls below this number, the pool will
     * be marked unhealthy and will failover to the next available pool.
     */
    minimum_origins?: number;
    modified_on?: string;
    /**
     * The ID of the Monitor to use for checking the health of origins within this
     * pool.
     */
    monitor?: string;
    /**
     * A short name (tag) for the pool. Only alphanumeric characters, hyphens, and
     * underscores are allowed.
     */
    name?: string;
    /**
     * List of networks where Load Balancer or Pool is enabled.
     */
    networks?: Array<string>;
    /**
     * This field is now deprecated. It has been moved to Cloudflare's Centralized
     * Notification service
     * https://developers.cloudflare.com/fundamentals/notifications/. The email address
     * to send health status notifications to. This can be an individual mailbox or a
     * mailing list. Multiple emails can be supplied as a comma delimited list.
     */
    notification_email?: string;
    /**
     * Filter pool and origin health notifications by resource type or health status.
     * Use null to reset.
     */
    notification_filter?: LoadBalancersAPI.NotificationFilter | null;
    /**
     * Configures origin steering for the pool. Controls how origins are selected for
     * new sessions and traffic without session affinity.
     */
    origin_steering?: LoadBalancersAPI.OriginSteering;
    /**
     * The list of origins within this pool. Traffic directed at this pool is balanced
     * across all currently healthy origins, provided the pool itself is healthy.
     */
    origins?: Array<LoadBalancersAPI.Origin>;
}
export interface PoolDeleteResponse {
    id?: string;
}
export interface PoolCreateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: A short name (tag) for the pool. Only alphanumeric characters,
     * hyphens, and underscores are allowed.
     */
    name: string;
    /**
     * Body param: The list of origins within this pool. Traffic directed at this pool
     * is balanced across all currently healthy origins, provided the pool itself is
     * healthy.
     */
    origins: Array<LoadBalancersAPI.OriginParam>;
    /**
     * Body param: A human-readable description of the pool.
     */
    description?: string;
    /**
     * Body param: Whether to enable (the default) or disable this pool. Disabled pools
     * will not receive traffic and are excluded from health checks. Disabling a pool
     * will cause any load balancers using it to failover to the next pool (if any).
     */
    enabled?: boolean;
    /**
     * Body param: The latitude of the data center containing the origins used in this
     * pool in decimal degrees. If this is set, longitude must also be set.
     */
    latitude?: number;
    /**
     * Body param: Configures load shedding policies and percentages for the pool.
     */
    load_shedding?: LoadBalancersAPI.LoadSheddingParam;
    /**
     * Body param: The longitude of the data center containing the origins used in this
     * pool in decimal degrees. If this is set, latitude must also be set.
     */
    longitude?: number;
    /**
     * Body param: The minimum number of origins that must be healthy for this pool to
     * serve traffic. If the number of healthy origins falls below this number, the
     * pool will be marked unhealthy and will failover to the next available pool.
     */
    minimum_origins?: number;
    /**
     * Body param: The ID of the Monitor to use for checking the health of origins
     * within this pool.
     */
    monitor?: string;
    /**
     * Body param: This field is now deprecated. It has been moved to Cloudflare's
     * Centralized Notification service
     * https://developers.cloudflare.com/fundamentals/notifications/. The email address
     * to send health status notifications to. This can be an individual mailbox or a
     * mailing list. Multiple emails can be supplied as a comma delimited list.
     */
    notification_email?: string;
    /**
     * Body param: Filter pool and origin health notifications by resource type or
     * health status. Use null to reset.
     */
    notification_filter?: LoadBalancersAPI.NotificationFilterParam | null;
    /**
     * Body param: Configures origin steering for the pool. Controls how origins are
     * selected for new sessions and traffic without session affinity.
     */
    origin_steering?: LoadBalancersAPI.OriginSteeringParam;
}
export interface PoolUpdateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: A short name (tag) for the pool. Only alphanumeric characters,
     * hyphens, and underscores are allowed.
     */
    name: string;
    /**
     * Body param: The list of origins within this pool. Traffic directed at this pool
     * is balanced across all currently healthy origins, provided the pool itself is
     * healthy.
     */
    origins: Array<LoadBalancersAPI.OriginParam>;
    /**
     * Body param: A list of regions from which to run health checks. Null means every
     * Cloudflare data center.
     */
    check_regions?: Array<LoadBalancersAPI.CheckRegionParam> | null;
    /**
     * Body param: A human-readable description of the pool.
     */
    description?: string;
    /**
     * Body param: Whether to enable (the default) or disable this pool. Disabled pools
     * will not receive traffic and are excluded from health checks. Disabling a pool
     * will cause any load balancers using it to failover to the next pool (if any).
     */
    enabled?: boolean;
    /**
     * Body param: The latitude of the data center containing the origins used in this
     * pool in decimal degrees. If this is set, longitude must also be set.
     */
    latitude?: number;
    /**
     * Body param: Configures load shedding policies and percentages for the pool.
     */
    load_shedding?: LoadBalancersAPI.LoadSheddingParam;
    /**
     * Body param: The longitude of the data center containing the origins used in this
     * pool in decimal degrees. If this is set, latitude must also be set.
     */
    longitude?: number;
    /**
     * Body param: The minimum number of origins that must be healthy for this pool to
     * serve traffic. If the number of healthy origins falls below this number, the
     * pool will be marked unhealthy and will failover to the next available pool.
     */
    minimum_origins?: number;
    /**
     * Body param: The ID of the Monitor to use for checking the health of origins
     * within this pool.
     */
    monitor?: string;
    /**
     * Body param: This field is now deprecated. It has been moved to Cloudflare's
     * Centralized Notification service
     * https://developers.cloudflare.com/fundamentals/notifications/. The email address
     * to send health status notifications to. This can be an individual mailbox or a
     * mailing list. Multiple emails can be supplied as a comma delimited list.
     */
    notification_email?: string;
    /**
     * Body param: Filter pool and origin health notifications by resource type or
     * health status. Use null to reset.
     */
    notification_filter?: LoadBalancersAPI.NotificationFilterParam | null;
    /**
     * Body param: Configures origin steering for the pool. Controls how origins are
     * selected for new sessions and traffic without session affinity.
     */
    origin_steering?: LoadBalancersAPI.OriginSteeringParam;
}
export interface PoolListParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Query param: The ID of the Monitor to use for checking the health of origins
     * within this pool.
     */
    monitor?: string;
}
export interface PoolDeleteParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface PoolBulkEditParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: The email address to send health status notifications to. This field
     * is now deprecated in favor of Cloudflare Notifications for Load Balancing, so
     * only resetting this field with an empty string `""` is accepted.
     */
    notification_email?: '';
}
export interface PoolEditParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: A list of regions from which to run health checks. Null means every
     * Cloudflare data center.
     */
    check_regions?: Array<LoadBalancersAPI.CheckRegionParam> | null;
    /**
     * Body param: A human-readable description of the pool.
     */
    description?: string;
    /**
     * Body param: Whether to enable (the default) or disable this pool. Disabled pools
     * will not receive traffic and are excluded from health checks. Disabling a pool
     * will cause any load balancers using it to failover to the next pool (if any).
     */
    enabled?: boolean;
    /**
     * Body param: The latitude of the data center containing the origins used in this
     * pool in decimal degrees. If this is set, longitude must also be set.
     */
    latitude?: number;
    /**
     * Body param: Configures load shedding policies and percentages for the pool.
     */
    load_shedding?: LoadBalancersAPI.LoadSheddingParam;
    /**
     * Body param: The longitude of the data center containing the origins used in this
     * pool in decimal degrees. If this is set, latitude must also be set.
     */
    longitude?: number;
    /**
     * Body param: The minimum number of origins that must be healthy for this pool to
     * serve traffic. If the number of healthy origins falls below this number, the
     * pool will be marked unhealthy and will failover to the next available pool.
     */
    minimum_origins?: number;
    /**
     * Body param: The ID of the Monitor to use for checking the health of origins
     * within this pool.
     */
    monitor?: string;
    /**
     * Body param: A short name (tag) for the pool. Only alphanumeric characters,
     * hyphens, and underscores are allowed.
     */
    name?: string;
    /**
     * Body param: This field is now deprecated. It has been moved to Cloudflare's
     * Centralized Notification service
     * https://developers.cloudflare.com/fundamentals/notifications/. The email address
     * to send health status notifications to. This can be an individual mailbox or a
     * mailing list. Multiple emails can be supplied as a comma delimited list.
     */
    notification_email?: string;
    /**
     * Body param: Filter pool and origin health notifications by resource type or
     * health status. Use null to reset.
     */
    notification_filter?: LoadBalancersAPI.NotificationFilterParam | null;
    /**
     * Body param: Configures origin steering for the pool. Controls how origins are
     * selected for new sessions and traffic without session affinity.
     */
    origin_steering?: LoadBalancersAPI.OriginSteeringParam;
    /**
     * Body param: The list of origins within this pool. Traffic directed at this pool
     * is balanced across all currently healthy origins, provided the pool itself is
     * healthy.
     */
    origins?: Array<LoadBalancersAPI.OriginParam>;
}
export interface PoolGetParams {
    /**
     * Identifier
     */
    account_id: string;
}
export declare namespace Pools {
    export { type Pool as Pool, type PoolDeleteResponse as PoolDeleteResponse, PoolsSinglePage as PoolsSinglePage, type PoolCreateParams as PoolCreateParams, type PoolUpdateParams as PoolUpdateParams, type PoolListParams as PoolListParams, type PoolDeleteParams as PoolDeleteParams, type PoolBulkEditParams as PoolBulkEditParams, type PoolEditParams as PoolEditParams, type PoolGetParams as PoolGetParams, };
    export { Health as Health, type HealthCreateResponse as HealthCreateResponse, type HealthGetResponse as HealthGetResponse, type HealthCreateParams as HealthCreateParams, type HealthGetParams as HealthGetParams, };
    export { References as References, type ReferenceGetResponse as ReferenceGetResponse, ReferenceGetResponsesSinglePage as ReferenceGetResponsesSinglePage, type ReferenceGetParams as ReferenceGetParams, };
}
//# sourceMappingURL=pools.d.ts.map