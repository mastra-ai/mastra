import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Outages extends APIResource {
    /**
     * Retrieves the latest Internet outages and anomalies.
     *
     * @example
     * ```ts
     * const outage = await client.radar.annotations.outages.get();
     * ```
     */
    get(query?: OutageGetParams, options?: Core.RequestOptions): Core.APIPromise<OutageGetResponse>;
    get(options?: Core.RequestOptions): Core.APIPromise<OutageGetResponse>;
    /**
     * Retrieves the number of outages by location.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.annotations.outages.locations();
     * ```
     */
    locations(query?: OutageLocationsParams, options?: Core.RequestOptions): Core.APIPromise<OutageLocationsResponse>;
    locations(options?: Core.RequestOptions): Core.APIPromise<OutageLocationsResponse>;
}
export interface OutageGetResponse {
    annotations: Array<OutageGetResponse.Annotation>;
}
export declare namespace OutageGetResponse {
    interface Annotation {
        id: string;
        asns: Array<number>;
        asnsDetails: Array<Annotation.ASNsDetail>;
        dataSource: string;
        eventType: string;
        locations: Array<string>;
        locationsDetails: Array<Annotation.LocationsDetail>;
        outage: Annotation.Outage;
        startDate: string;
        description?: string;
        endDate?: string;
        linkedUrl?: string;
        scope?: string;
    }
    namespace Annotation {
        interface ASNsDetail {
            asn: string;
            name: string;
            locations?: ASNsDetail.Locations;
        }
        namespace ASNsDetail {
            interface Locations {
                code: string;
                name: string;
            }
        }
        interface LocationsDetail {
            code: string;
            name: string;
        }
        interface Outage {
            outageCause: string;
            outageType: string;
        }
    }
}
export interface OutageLocationsResponse {
    annotations: Array<OutageLocationsResponse.Annotation>;
}
export declare namespace OutageLocationsResponse {
    interface Annotation {
        clientCountryAlpha2: string;
        clientCountryName: string;
        /**
         * A numeric string.
         */
        value: string;
    }
}
export interface OutageGetParams {
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
}
export interface OutageLocationsParams {
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
}
export declare namespace Outages {
    export { type OutageGetResponse as OutageGetResponse, type OutageLocationsResponse as OutageLocationsResponse, type OutageGetParams as OutageGetParams, type OutageLocationsParams as OutageLocationsParams, };
}
//# sourceMappingURL=outages.d.ts.map