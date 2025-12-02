import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class IncomingResource extends APIResource {
    /**
     * Create secondary zone configuration for incoming zone transfers.
     *
     * @example
     * ```ts
     * const incoming =
     *   await client.dns.zoneTransfers.incoming.create({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *     auto_refresh_seconds: 86400,
     *     name: 'www.example.com.',
     *     peers: [
     *       '23ff594956f20c2a721606e94745a8aa',
     *       '00920f38ce07c2e2f4df50b1f61d4194',
     *     ],
     *   });
     * ```
     */
    create(params: IncomingCreateParams, options?: Core.RequestOptions): Core.APIPromise<IncomingCreateResponse>;
    /**
     * Update secondary zone configuration for incoming zone transfers.
     *
     * @example
     * ```ts
     * const incoming =
     *   await client.dns.zoneTransfers.incoming.update({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *     auto_refresh_seconds: 86400,
     *     name: 'www.example.com.',
     *     peers: [
     *       '23ff594956f20c2a721606e94745a8aa',
     *       '00920f38ce07c2e2f4df50b1f61d4194',
     *     ],
     *   });
     * ```
     */
    update(params: IncomingUpdateParams, options?: Core.RequestOptions): Core.APIPromise<IncomingUpdateResponse>;
    /**
     * Delete secondary zone configuration for incoming zone transfers.
     *
     * @example
     * ```ts
     * const incoming =
     *   await client.dns.zoneTransfers.incoming.delete({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *   });
     * ```
     */
    delete(params: IncomingDeleteParams, options?: Core.RequestOptions): Core.APIPromise<IncomingDeleteResponse>;
    /**
     * Get secondary zone configuration for incoming zone transfers.
     *
     * @example
     * ```ts
     * const incoming =
     *   await client.dns.zoneTransfers.incoming.get({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *   });
     * ```
     */
    get(params: IncomingGetParams, options?: Core.RequestOptions): Core.APIPromise<IncomingGetResponse>;
}
export interface Incoming {
    id?: string;
    /**
     * How often should a secondary zone auto refresh regardless of DNS NOTIFY. Not
     * applicable for primary zones.
     */
    auto_refresh_seconds?: number;
    /**
     * The time for a specific event.
     */
    checked_time?: string;
    /**
     * The time for a specific event.
     */
    created_time?: string;
    /**
     * The time for a specific event.
     */
    modified_time?: string;
    /**
     * Zone name.
     */
    name?: string;
    /**
     * A list of peer tags.
     */
    peers?: Array<string>;
    /**
     * The serial number of the SOA for the given zone.
     */
    soa_serial?: number;
}
export interface IncomingCreateResponse {
    id?: string;
    /**
     * How often should a secondary zone auto refresh regardless of DNS NOTIFY. Not
     * applicable for primary zones.
     */
    auto_refresh_seconds?: number;
    /**
     * The time for a specific event.
     */
    checked_time?: string;
    /**
     * The time for a specific event.
     */
    created_time?: string;
    /**
     * The time for a specific event.
     */
    modified_time?: string;
    /**
     * Zone name.
     */
    name?: string;
    /**
     * A list of peer tags.
     */
    peers?: Array<string>;
    /**
     * The serial number of the SOA for the given zone.
     */
    soa_serial?: number;
}
export interface IncomingUpdateResponse {
    id?: string;
    /**
     * How often should a secondary zone auto refresh regardless of DNS NOTIFY. Not
     * applicable for primary zones.
     */
    auto_refresh_seconds?: number;
    /**
     * The time for a specific event.
     */
    checked_time?: string;
    /**
     * The time for a specific event.
     */
    created_time?: string;
    /**
     * The time for a specific event.
     */
    modified_time?: string;
    /**
     * Zone name.
     */
    name?: string;
    /**
     * A list of peer tags.
     */
    peers?: Array<string>;
    /**
     * The serial number of the SOA for the given zone.
     */
    soa_serial?: number;
}
export interface IncomingDeleteResponse {
    id?: string;
}
export interface IncomingGetResponse {
    id?: string;
    /**
     * How often should a secondary zone auto refresh regardless of DNS NOTIFY. Not
     * applicable for primary zones.
     */
    auto_refresh_seconds?: number;
    /**
     * The time for a specific event.
     */
    checked_time?: string;
    /**
     * The time for a specific event.
     */
    created_time?: string;
    /**
     * The time for a specific event.
     */
    modified_time?: string;
    /**
     * Zone name.
     */
    name?: string;
    /**
     * A list of peer tags.
     */
    peers?: Array<string>;
    /**
     * The serial number of the SOA for the given zone.
     */
    soa_serial?: number;
}
export interface IncomingCreateParams {
    /**
     * Path param:
     */
    zone_id: string;
    /**
     * Body param: How often should a secondary zone auto refresh regardless of DNS
     * NOTIFY. Not applicable for primary zones.
     */
    auto_refresh_seconds: number;
    /**
     * Body param: Zone name.
     */
    name: string;
    /**
     * Body param: A list of peer tags.
     */
    peers: Array<string>;
}
export interface IncomingUpdateParams {
    /**
     * Path param:
     */
    zone_id: string;
    /**
     * Body param: How often should a secondary zone auto refresh regardless of DNS
     * NOTIFY. Not applicable for primary zones.
     */
    auto_refresh_seconds: number;
    /**
     * Body param: Zone name.
     */
    name: string;
    /**
     * Body param: A list of peer tags.
     */
    peers: Array<string>;
}
export interface IncomingDeleteParams {
    zone_id: string;
}
export interface IncomingGetParams {
    zone_id: string;
}
export declare namespace IncomingResource {
    export { type Incoming as Incoming, type IncomingCreateResponse as IncomingCreateResponse, type IncomingUpdateResponse as IncomingUpdateResponse, type IncomingDeleteResponse as IncomingDeleteResponse, type IncomingGetResponse as IncomingGetResponse, type IncomingCreateParams as IncomingCreateParams, type IncomingUpdateParams as IncomingUpdateParams, type IncomingDeleteParams as IncomingDeleteParams, type IncomingGetParams as IncomingGetParams, };
}
//# sourceMappingURL=incoming.d.ts.map