import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as ASNsAPI from "./asns.js";
import { ASNGetParams, ASNGetResponse, ASNIPParams, ASNIPResponse, ASNListParams, ASNListResponse, ASNRelParams, ASNRelResponse, ASNs } from "./asns.js";
import * as LocationsAPI from "./locations.js";
import { LocationGetParams, LocationGetResponse, LocationListParams, LocationListResponse, Locations } from "./locations.js";
export declare class Entities extends APIResource {
    asns: ASNsAPI.ASNs;
    locations: LocationsAPI.Locations;
    /**
     * Retrieves IP address information.
     *
     * @example
     * ```ts
     * const entity = await client.radar.entities.get({
     *   ip: '8.8.8.8',
     * });
     * ```
     */
    get(query: EntityGetParams, options?: Core.RequestOptions): Core.APIPromise<EntityGetResponse>;
}
export interface EntityGetResponse {
    ip: EntityGetResponse.IP;
}
export declare namespace EntityGetResponse {
    interface IP {
        asn: string;
        asnLocation: string;
        asnName: string;
        asnOrgName: string;
        ip: string;
        ipVersion: string;
        location: string;
        locationName: string;
    }
}
export interface EntityGetParams {
    /**
     * IP address.
     */
    ip: string;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
}
export declare namespace Entities {
    export { type EntityGetResponse as EntityGetResponse, type EntityGetParams as EntityGetParams };
    export { ASNs as ASNs, type ASNListResponse as ASNListResponse, type ASNGetResponse as ASNGetResponse, type ASNIPResponse as ASNIPResponse, type ASNRelResponse as ASNRelResponse, type ASNListParams as ASNListParams, type ASNGetParams as ASNGetParams, type ASNIPParams as ASNIPParams, type ASNRelParams as ASNRelParams, };
    export { Locations as Locations, type LocationListResponse as LocationListResponse, type LocationGetResponse as LocationGetResponse, type LocationListParams as LocationListParams, type LocationGetParams as LocationGetParams, };
}
//# sourceMappingURL=entities.d.ts.map