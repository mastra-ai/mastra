import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as LocationsAPI from "./locations.js";
import { LocationGetParams, LocationGetResponse, Locations as LocationsAPILocations } from "./locations.js";
export declare class TrafficAnomalies extends APIResource {
    locations: LocationsAPI.Locations;
    /**
     * Retrieves the latest Internet traffic anomalies, which are signals that might
     * indicate an outage. These alerts are automatically detected by Radar and
     * manually verified by our team.
     *
     * @example
     * ```ts
     * const trafficAnomaly =
     *   await client.radar.trafficAnomalies.get();
     * ```
     */
    get(query?: TrafficAnomalyGetParams, options?: Core.RequestOptions): Core.APIPromise<TrafficAnomalyGetResponse>;
    get(options?: Core.RequestOptions): Core.APIPromise<TrafficAnomalyGetResponse>;
}
export interface TrafficAnomalyGetResponse {
    trafficAnomalies: Array<TrafficAnomalyGetResponse.TrafficAnomaly>;
}
export declare namespace TrafficAnomalyGetResponse {
    interface TrafficAnomaly {
        startDate: string;
        status: string;
        type: string;
        uuid: string;
        asnDetails?: TrafficAnomaly.ASNDetails;
        endDate?: string;
        locationDetails?: TrafficAnomaly.LocationDetails;
        visibleInDataSources?: Array<string>;
    }
    namespace TrafficAnomaly {
        interface ASNDetails {
            asn: string;
            name: string;
            locations?: ASNDetails.Locations;
        }
        namespace ASNDetails {
            interface Locations {
                code: string;
                name: string;
            }
        }
        interface LocationDetails {
            code: string;
            name: string;
        }
    }
}
export interface TrafficAnomalyGetParams {
    /**
     * Filters results by Autonomous System. Specify a single Autonomous System Number
     * (ASN) as integer.
     */
    asn?: number;
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
    /**
     * Filters results by location. Specify an alpha-2 location code.
     */
    location?: string;
    /**
     * Skips the specified number of objects before fetching the results.
     */
    offset?: number;
    status?: 'VERIFIED' | 'UNVERIFIED';
}
export declare namespace TrafficAnomalies {
    export { type TrafficAnomalyGetResponse as TrafficAnomalyGetResponse, type TrafficAnomalyGetParams as TrafficAnomalyGetParams, };
    export { LocationsAPILocations as Locations, type LocationGetResponse as LocationGetResponse, type LocationGetParams as LocationGetParams, };
}
//# sourceMappingURL=traffic-anomalies.d.ts.map