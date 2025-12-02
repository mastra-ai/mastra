import { APIResource } from "../../resource.js";
import * as AppsAPI from "./apps.js";
import { AppCreateParams, AppCreateResponse, AppDeleteParams, AppDeleteResponse, AppGetParams, AppGetResponse, AppListParams, AppListResponse, AppListResponsesV4PagePaginationArray, AppUpdateParams, AppUpdateResponse, Apps } from "./apps.js";
import * as AnalyticsAPI from "./analytics/analytics.js";
import { Analytics } from "./analytics/analytics.js";
export declare class Spectrum extends APIResource {
    analytics: AnalyticsAPI.Analytics;
    apps: AppsAPI.Apps;
}
/**
 * The name and type of DNS record for the Spectrum application.
 */
export interface DNS {
    /**
     * The name of the DNS record associated with the application.
     */
    name?: string;
    /**
     * The type of DNS record associated with the application.
     */
    type?: 'CNAME' | 'ADDRESS';
}
/**
 * The name and type of DNS record for the Spectrum application.
 */
export interface DNSParam {
    /**
     * The name of the DNS record associated with the application.
     */
    name?: string;
    /**
     * The type of DNS record associated with the application.
     */
    type?: 'CNAME' | 'ADDRESS';
}
/**
 * The anycast edge IP configuration for the hostname of this application.
 */
export type EdgeIPs = EdgeIPs.Dynamic | EdgeIPs.Static;
export declare namespace EdgeIPs {
    interface Dynamic {
        /**
         * The IP versions supported for inbound connections on Spectrum anycast IPs.
         */
        connectivity?: 'all' | 'ipv4' | 'ipv6';
        /**
         * The type of edge IP configuration specified. Dynamically allocated edge IPs use
         * Spectrum anycast IPs in accordance with the connectivity you specify. Only valid
         * with CNAME DNS names.
         */
        type?: 'dynamic';
    }
    interface Static {
        /**
         * The array of customer owned IPs we broadcast via anycast for this hostname and
         * application.
         */
        ips?: Array<string>;
        /**
         * The type of edge IP configuration specified. Statically allocated edge IPs use
         * customer IPs in accordance with the ips array you specify. Only valid with
         * ADDRESS DNS names.
         */
        type?: 'static';
    }
}
/**
 * The anycast edge IP configuration for the hostname of this application.
 */
export type EdgeIPsParam = EdgeIPsParam.Dynamic | EdgeIPsParam.Static;
export declare namespace EdgeIPsParam {
    interface Dynamic {
        /**
         * The IP versions supported for inbound connections on Spectrum anycast IPs.
         */
        connectivity?: 'all' | 'ipv4' | 'ipv6';
        /**
         * The type of edge IP configuration specified. Dynamically allocated edge IPs use
         * Spectrum anycast IPs in accordance with the connectivity you specify. Only valid
         * with CNAME DNS names.
         */
        type?: 'dynamic';
    }
    interface Static {
        /**
         * The array of customer owned IPs we broadcast via anycast for this hostname and
         * application.
         */
        ips?: Array<string>;
        /**
         * The type of edge IP configuration specified. Statically allocated edge IPs use
         * customer IPs in accordance with the ips array you specify. Only valid with
         * ADDRESS DNS names.
         */
        type?: 'static';
    }
}
/**
 * The name and type of DNS record for the Spectrum application.
 */
export interface OriginDNS {
    /**
     * The name of the DNS record associated with the origin.
     */
    name?: string;
    /**
     * The TTL of our resolution of your DNS record in seconds.
     */
    ttl?: number;
    /**
     * The type of DNS record associated with the origin. "" is used to specify a
     * combination of A/AAAA records.
     */
    type?: '' | 'A' | 'AAAA' | 'SRV';
}
/**
 * The name and type of DNS record for the Spectrum application.
 */
export interface OriginDNSParam {
    /**
     * The name of the DNS record associated with the origin.
     */
    name?: string;
    /**
     * The TTL of our resolution of your DNS record in seconds.
     */
    ttl?: number;
    /**
     * The type of DNS record associated with the origin. "" is used to specify a
     * combination of A/AAAA records.
     */
    type?: '' | 'A' | 'AAAA' | 'SRV';
}
/**
 * The destination port at the origin. Only specified in conjunction with
 * origin_dns. May use an integer to specify a single origin port, for example
 * `1000`, or a string to specify a range of origin ports, for example
 * `"1000-2000"`. Notes: If specifying a port range, the number of ports in the
 * range must match the number of ports specified in the "protocol" field.
 */
export type OriginPort = number | string;
/**
 * The destination port at the origin. Only specified in conjunction with
 * origin_dns. May use an integer to specify a single origin port, for example
 * `1000`, or a string to specify a range of origin ports, for example
 * `"1000-2000"`. Notes: If specifying a port range, the number of ports in the
 * range must match the number of ports specified in the "protocol" field.
 */
export type OriginPortParam = number | string;
export declare namespace Spectrum {
    export { type DNS as DNS, type EdgeIPs as EdgeIPs, type OriginDNS as OriginDNS, type OriginPort as OriginPort, };
    export { Analytics as Analytics };
    export { Apps as Apps, type AppCreateResponse as AppCreateResponse, type AppUpdateResponse as AppUpdateResponse, type AppListResponse as AppListResponse, type AppDeleteResponse as AppDeleteResponse, type AppGetResponse as AppGetResponse, AppListResponsesV4PagePaginationArray as AppListResponsesV4PagePaginationArray, type AppCreateParams as AppCreateParams, type AppUpdateParams as AppUpdateParams, type AppListParams as AppListParams, type AppDeleteParams as AppDeleteParams, type AppGetParams as AppGetParams, };
}
//# sourceMappingURL=spectrum.d.ts.map