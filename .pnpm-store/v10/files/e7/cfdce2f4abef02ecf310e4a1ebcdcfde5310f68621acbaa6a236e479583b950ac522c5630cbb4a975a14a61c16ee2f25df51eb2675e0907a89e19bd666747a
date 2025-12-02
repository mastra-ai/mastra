import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class ASNs extends APIResource {
    /**
     * Retrieves a list of autonomous systems.
     *
     * @example
     * ```ts
     * const asns = await client.radar.entities.asns.list();
     * ```
     */
    list(query?: ASNListParams, options?: Core.RequestOptions): Core.APIPromise<ASNListResponse>;
    list(options?: Core.RequestOptions): Core.APIPromise<ASNListResponse>;
    /**
     * Retrieves the requested autonomous system information. (A confidence level below
     * `5` indicates a low level of confidence in the traffic data - normally this
     * happens because Cloudflare has a small amount of traffic from/to this AS).
     * Population estimates come from APNIC (refer to https://labs.apnic.net/?p=526).
     *
     * @example
     * ```ts
     * const asn = await client.radar.entities.asns.get(174);
     * ```
     */
    get(asn: number, query?: ASNGetParams, options?: Core.RequestOptions): Core.APIPromise<ASNGetResponse>;
    get(asn: number, options?: Core.RequestOptions): Core.APIPromise<ASNGetResponse>;
    /**
     * Retrieves the requested autonomous system information based on IP address.
     * Population estimates come from APNIC (refer to https://labs.apnic.net/?p=526).
     *
     * @example
     * ```ts
     * const response = await client.radar.entities.asns.ip({
     *   ip: '8.8.8.8',
     * });
     * ```
     */
    ip(query: ASNIPParams, options?: Core.RequestOptions): Core.APIPromise<ASNIPResponse>;
    /**
     * Retrieves AS-level relationship for given networks.
     *
     * @example
     * ```ts
     * const response = await client.radar.entities.asns.rel(3);
     * ```
     */
    rel(asn: number, query?: ASNRelParams, options?: Core.RequestOptions): Core.APIPromise<ASNRelResponse>;
    rel(asn: number, options?: Core.RequestOptions): Core.APIPromise<ASNRelResponse>;
}
export interface ASNListResponse {
    asns: Array<ASNListResponse.ASN>;
}
export declare namespace ASNListResponse {
    interface ASN {
        asn: number;
        country: string;
        countryName: string;
        name: string;
        aka?: string;
        orgName?: string;
        website?: string;
    }
}
export interface ASNGetResponse {
    asn: ASNGetResponse.ASN;
}
export declare namespace ASNGetResponse {
    interface ASN {
        asn: number;
        confidenceLevel: number;
        country: string;
        countryName: string;
        estimatedUsers: ASN.EstimatedUsers;
        name: string;
        orgName: string;
        related: Array<ASN.Related>;
        /**
         * Regional Internet Registry.
         */
        source: string;
        website: string;
        aka?: string;
    }
    namespace ASN {
        interface EstimatedUsers {
            locations: Array<EstimatedUsers.Location>;
            /**
             * Total estimated users.
             */
            estimatedUsers?: number;
        }
        namespace EstimatedUsers {
            interface Location {
                locationAlpha2: string;
                locationName: string;
                /**
                 * Estimated users per location.
                 */
                estimatedUsers?: number;
            }
        }
        interface Related {
            asn: number;
            name: string;
            aka?: string;
            /**
             * Total estimated users.
             */
            estimatedUsers?: number;
        }
    }
}
export interface ASNIPResponse {
    asn: ASNIPResponse.ASN;
}
export declare namespace ASNIPResponse {
    interface ASN {
        asn: number;
        country: string;
        countryName: string;
        estimatedUsers: ASN.EstimatedUsers;
        name: string;
        orgName: string;
        related: Array<ASN.Related>;
        /**
         * Regional Internet Registry.
         */
        source: string;
        website: string;
        aka?: string;
    }
    namespace ASN {
        interface EstimatedUsers {
            locations: Array<EstimatedUsers.Location>;
            /**
             * Total estimated users.
             */
            estimatedUsers?: number;
        }
        namespace EstimatedUsers {
            interface Location {
                locationAlpha2: string;
                locationName: string;
                /**
                 * Estimated users per location.
                 */
                estimatedUsers?: number;
            }
        }
        interface Related {
            asn: number;
            name: string;
            aka?: string;
            /**
             * Total estimated users.
             */
            estimatedUsers?: number;
        }
    }
}
export interface ASNRelResponse {
    meta: ASNRelResponse.Meta;
    rels: Array<ASNRelResponse.Rel>;
}
export declare namespace ASNRelResponse {
    interface Meta {
        data_time: string;
        query_time: string;
        total_peers: number;
    }
    interface Rel {
        asn1: number;
        asn1_country: string;
        asn1_name: string;
        asn2: number;
        asn2_country: string;
        asn2_name: string;
        rel: string;
    }
}
export interface ASNListParams {
    /**
     * Filters results by Autonomous System. Specify one or more Autonomous System
     * Numbers (ASNs) as a comma-separated list.
     */
    asn?: string;
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
    /**
     * Specifies the metric to order the ASNs by.
     */
    orderBy?: 'ASN' | 'POPULATION';
}
export interface ASNGetParams {
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
}
export interface ASNIPParams {
    /**
     * IP address.
     */
    ip: string;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
}
export interface ASNRelParams {
    /**
     * Retrieves the AS relationship of ASN2 with respect to the given ASN.
     */
    asn2?: number;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
}
export declare namespace ASNs {
    export { type ASNListResponse as ASNListResponse, type ASNGetResponse as ASNGetResponse, type ASNIPResponse as ASNIPResponse, type ASNRelResponse as ASNRelResponse, type ASNListParams as ASNListParams, type ASNGetParams as ASNGetParams, type ASNIPParams as ASNIPParams, type ASNRelParams as ASNRelParams, };
}
//# sourceMappingURL=asns.d.ts.map