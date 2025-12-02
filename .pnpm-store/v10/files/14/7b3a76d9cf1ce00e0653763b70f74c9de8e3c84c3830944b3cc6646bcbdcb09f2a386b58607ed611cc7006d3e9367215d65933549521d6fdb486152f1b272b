import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Locations extends APIResource {
    /**
     * Retrieves a list of locations.
     *
     * @example
     * ```ts
     * const locations =
     *   await client.radar.entities.locations.list();
     * ```
     */
    list(query?: LocationListParams, options?: Core.RequestOptions): Core.APIPromise<LocationListResponse>;
    list(options?: Core.RequestOptions): Core.APIPromise<LocationListResponse>;
    /**
     * Retrieves the requested location information. (A confidence level below `5`
     * indicates a low level of confidence in the traffic data - normally this happens
     * because Cloudflare has a small amount of traffic from/to this location).
     *
     * @example
     * ```ts
     * const location = await client.radar.entities.locations.get(
     *   'US',
     * );
     * ```
     */
    get(location: string, query?: LocationGetParams, options?: Core.RequestOptions): Core.APIPromise<LocationGetResponse>;
    get(location: string, options?: Core.RequestOptions): Core.APIPromise<LocationGetResponse>;
}
export interface LocationListResponse {
    locations: Array<LocationListResponse.Location>;
}
export declare namespace LocationListResponse {
    interface Location {
        alpha2: string;
        /**
         * A numeric string.
         */
        latitude: string;
        /**
         * A numeric string.
         */
        longitude: string;
        name: string;
    }
}
export interface LocationGetResponse {
    location: LocationGetResponse.Location;
}
export declare namespace LocationGetResponse {
    interface Location {
        alpha2: string;
        confidenceLevel: number;
        /**
         * A numeric string.
         */
        latitude: string;
        /**
         * A numeric string.
         */
        longitude: string;
        name: string;
        region: string;
        subregion: string;
    }
}
export interface LocationListParams {
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Limits the number of objects returned in the response.
     */
    limit?: number;
    /**
     * Filters results by location. Specify a comma-separated list of alpha-2 location
     * codes.
     */
    location?: string;
    /**
     * Skips the specified number of objects before fetching the results.
     */
    offset?: number;
}
export interface LocationGetParams {
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
}
export declare namespace Locations {
    export { type LocationListResponse as LocationListResponse, type LocationGetResponse as LocationGetResponse, type LocationListParams as LocationListParams, type LocationGetParams as LocationGetParams, };
}
//# sourceMappingURL=locations.d.ts.map