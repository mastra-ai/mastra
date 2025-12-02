import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Holds extends APIResource {
    /**
     * Enforce a zone hold on the zone, blocking the creation and activation of zones
     * with this zone's hostname.
     *
     * @example
     * ```ts
     * const zoneHold = await client.zones.holds.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params: HoldCreateParams, options?: Core.RequestOptions): Core.APIPromise<ZoneHold>;
    /**
     * Stop enforcement of a zone hold on the zone, permanently or temporarily,
     * allowing the creation and activation of zones with this zone's hostname.
     *
     * @example
     * ```ts
     * const zoneHold = await client.zones.holds.delete({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    delete(params: HoldDeleteParams, options?: Core.RequestOptions): Core.APIPromise<ZoneHold>;
    /**
     * Update the `hold_after` and/or `include_subdomains` values on an existing zone
     * hold. The hold is enabled if the `hold_after` date-time value is in the past.
     *
     * @example
     * ```ts
     * const zoneHold = await client.zones.holds.edit({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    edit(params: HoldEditParams, options?: Core.RequestOptions): Core.APIPromise<ZoneHold>;
    /**
     * Retrieve whether the zone is subject to a zone hold, and metadata about the
     * hold.
     *
     * @example
     * ```ts
     * const zoneHold = await client.zones.holds.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: HoldGetParams, options?: Core.RequestOptions): Core.APIPromise<ZoneHold>;
}
export interface ZoneHold {
    hold?: boolean;
    hold_after?: string;
    include_subdomains?: string;
}
export interface HoldCreateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Query param: If provided, the zone hold will extend to block any subdomain of
     * the given zone, as well as SSL4SaaS Custom Hostnames. For example, a zone hold
     * on a zone with the hostname 'example.com' and include_subdomains=true will block
     * 'example.com', 'staging.example.com', 'api.staging.example.com', etc.
     */
    include_subdomains?: boolean;
}
export interface HoldDeleteParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Query param: If `hold_after` is provided, the hold will be temporarily disabled,
     * then automatically re-enabled by the system at the time specified in this
     * RFC3339-formatted timestamp. Otherwise, the hold will be disabled indefinitely.
     */
    hold_after?: string;
}
export interface HoldEditParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: If `hold_after` is provided and future-dated, the hold will be
     * temporarily disabled, then automatically re-enabled by the system at the time
     * specified in this RFC3339-formatted timestamp. A past-dated `hold_after` value
     * will have no effect on an existing, enabled hold. Providing an empty string will
     * set its value to the current time.
     */
    hold_after?: string;
    /**
     * Body param: If `true`, the zone hold will extend to block any subdomain of the
     * given zone, as well as SSL4SaaS Custom Hostnames. For example, a zone hold on a
     * zone with the hostname 'example.com' and include_subdomains=true will block
     * 'example.com', 'staging.example.com', 'api.staging.example.com', etc.
     */
    include_subdomains?: boolean;
}
export interface HoldGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace Holds {
    export { type ZoneHold as ZoneHold, type HoldCreateParams as HoldCreateParams, type HoldDeleteParams as HoldDeleteParams, type HoldEditParams as HoldEditParams, type HoldGetParams as HoldGetParams, };
}
//# sourceMappingURL=holds.d.ts.map