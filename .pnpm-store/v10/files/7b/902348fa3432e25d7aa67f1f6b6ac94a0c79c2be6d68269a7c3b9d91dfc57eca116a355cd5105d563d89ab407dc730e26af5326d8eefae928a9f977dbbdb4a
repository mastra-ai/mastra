import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as OutagesAPI from "./outages.js";
import { OutageGetParams, OutageGetResponse, OutageLocationsParams, OutageLocationsResponse, Outages } from "./outages.js";
export declare class Annotations extends APIResource {
    outages: OutagesAPI.Outages;
    /**
     * Retrieves the latest annotations.
     *
     * @example
     * ```ts
     * const annotations = await client.radar.annotations.list();
     * ```
     */
    list(query?: AnnotationListParams, options?: Core.RequestOptions): Core.APIPromise<AnnotationListResponse>;
    list(options?: Core.RequestOptions): Core.APIPromise<AnnotationListResponse>;
}
export interface AnnotationListResponse {
    annotations: Array<AnnotationListResponse.Annotation>;
}
export declare namespace AnnotationListResponse {
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
export interface AnnotationListParams {
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
export declare namespace Annotations {
    export { type AnnotationListResponse as AnnotationListResponse, type AnnotationListParams as AnnotationListParams, };
    export { Outages as Outages, type OutageGetResponse as OutageGetResponse, type OutageLocationsResponse as OutageLocationsResponse, type OutageGetParams as OutageGetParams, type OutageLocationsParams as OutageLocationsParams, };
}
//# sourceMappingURL=annotations.d.ts.map