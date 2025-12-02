import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Locations extends APIResource {
    /**
     * Retrieves the sum of Internet traffic anomalies, grouped by location. These
     * anomalies are signals that might indicate an outage, automatically detected by
     * Radar and manually verified by our team.
     *
     * @example
     * ```ts
     * const location =
     *   await client.radar.trafficAnomalies.locations.get();
     * ```
     */
    get(query?: LocationGetParams, options?: Core.RequestOptions): Core.APIPromise<LocationGetResponse>;
    get(options?: Core.RequestOptions): Core.APIPromise<LocationGetResponse>;
}
export interface LocationGetResponse {
    trafficAnomalies: Array<LocationGetResponse.TrafficAnomaly>;
}
export declare namespace LocationGetResponse {
    interface TrafficAnomaly {
        clientCountryAlpha2: string;
        clientCountryName: string;
        /**
         * A numeric string.
         */
        value: string;
    }
}
export interface LocationGetParams {
    /**
     * End of the date range (inclusive).
     */
    dateEnd?: string;
    /**
     * Filters results by date range.
     */
    dateRange?: string;
    /**
     * Start of the date range (inclusive).
     */
    dateStart?: string;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Limits the number of objects returned in the response.
     */
    limit?: number;
    status?: 'VERIFIED' | 'UNVERIFIED';
}
export declare namespace Locations {
    export { type LocationGetResponse as LocationGetResponse, type LocationGetParams as LocationGetParams };
}
//# sourceMappingURL=locations.d.ts.map