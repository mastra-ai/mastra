import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as SpectrumAPI from "./spectrum.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class Apps extends APIResource {
    /**
     * Creates a new Spectrum application from a configuration using a name for the
     * origin.
     *
     * @example
     * ```ts
     * const app = await client.spectrum.apps.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   dns: {},
     *   ip_firewall: true,
     *   protocol: 'tcp/22',
     *   proxy_protocol: 'off',
     *   tls: 'full',
     *   traffic_type: 'direct',
     * });
     * ```
     */
    create(params: AppCreateParams, options?: Core.RequestOptions): Core.APIPromise<AppCreateResponse>;
    /**
     * Updates a previously existing application's configuration that uses a name for
     * the origin.
     *
     * @example
     * ```ts
     * const app = await client.spectrum.apps.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     dns: {},
     *     ip_firewall: true,
     *     protocol: 'tcp/22',
     *     proxy_protocol: 'off',
     *     tls: 'full',
     *     traffic_type: 'direct',
     *   },
     * );
     * ```
     */
    update(appId: string, params: AppUpdateParams, options?: Core.RequestOptions): Core.APIPromise<AppUpdateResponse>;
    /**
     * Retrieves a list of currently existing Spectrum applications inside a zone.
     */
    list(params: AppListParams, options?: Core.RequestOptions): Core.PagePromise<AppListResponsesV4PagePaginationArray, AppListResponse>;
    /**
     * Deletes a previously existing application.
     */
    delete(appId: string, params: AppDeleteParams, options?: Core.RequestOptions): Core.APIPromise<AppDeleteResponse | null>;
    /**
     * Gets the application configuration of a specific application inside a zone.
     */
    get(appId: string, params: AppGetParams, options?: Core.RequestOptions): Core.APIPromise<AppGetResponse>;
}
export declare class AppListResponsesV4PagePaginationArray extends V4PagePaginationArray<AppListResponse> {
}
export type AppCreateResponse = AppCreateResponse.SpectrumConfigAppConfig | AppCreateResponse.SpectrumConfigPaygoAppConfig;
export declare namespace AppCreateResponse {
    interface SpectrumConfigAppConfig {
        /**
         * App identifier.
         */
        id: string;
        /**
         * When the Application was created.
         */
        created_on: string;
        /**
         * The name and type of DNS record for the Spectrum application.
         */
        dns: SpectrumAPI.DNS;
        /**
         * Enables IP Access Rules for this application. Notes: Only available for TCP
         * applications.
         */
        ip_firewall: boolean;
        /**
         * When the Application was last modified.
         */
        modified_on: string;
        /**
         * The port configuration at Cloudflare's edge. May specify a single port, for
         * example `"tcp/1000"`, or a range of ports, for example `"tcp/1000-2000"`.
         */
        protocol: string;
        /**
         * Enables Proxy Protocol to the origin. Refer to
         * [Enable Proxy protocol](https://developers.cloudflare.com/spectrum/getting-started/proxy-protocol/)
         * for implementation details on PROXY Protocol V1, PROXY Protocol V2, and Simple
         * Proxy Protocol.
         */
        proxy_protocol: 'off' | 'v1' | 'v2' | 'simple';
        /**
         * The type of TLS termination associated with the application.
         */
        tls: 'off' | 'flexible' | 'full' | 'strict';
        /**
         * Determines how data travels from the edge to your origin. When set to "direct",
         * Spectrum will send traffic directly to your origin, and the application's type
         * is derived from the `protocol`. When set to "http" or "https", Spectrum will
         * apply Cloudflare's HTTP/HTTPS features as it sends traffic to your origin, and
         * the application type matches this property exactly.
         */
        traffic_type: 'direct' | 'http' | 'https';
        /**
         * Enables Argo Smart Routing for this application. Notes: Only available for TCP
         * applications with traffic_type set to "direct".
         */
        argo_smart_routing?: boolean;
        /**
         * The anycast edge IP configuration for the hostname of this application.
         */
        edge_ips?: SpectrumAPI.EdgeIPs;
        /**
         * List of origin IP addresses. Array may contain multiple IP addresses for load
         * balancing.
         */
        origin_direct?: Array<string>;
        /**
         * The name and type of DNS record for the Spectrum application.
         */
        origin_dns?: SpectrumAPI.OriginDNS;
        /**
         * The destination port at the origin. Only specified in conjunction with
         * origin_dns. May use an integer to specify a single origin port, for example
         * `1000`, or a string to specify a range of origin ports, for example
         * `"1000-2000"`. Notes: If specifying a port range, the number of ports in the
         * range must match the number of ports specified in the "protocol" field.
         */
        origin_port?: SpectrumAPI.OriginPort;
    }
    interface SpectrumConfigPaygoAppConfig {
        /**
         * App identifier.
         */
        id: string;
        /**
         * When the Application was created.
         */
        created_on: string;
        /**
         * The name and type of DNS record for the Spectrum application.
         */
        dns: SpectrumAPI.DNS;
        /**
         * When the Application was last modified.
         */
        modified_on: string;
        /**
         * The port configuration at Cloudflare's edge. May specify a single port, for
         * example `"tcp/1000"`, or a range of ports, for example `"tcp/1000-2000"`.
         */
        protocol: string;
        /**
         * List of origin IP addresses. Array may contain multiple IP addresses for load
         * balancing.
         */
        origin_direct?: Array<string>;
    }
}
export type AppUpdateResponse = AppUpdateResponse.SpectrumConfigAppConfig | AppUpdateResponse.SpectrumConfigPaygoAppConfig;
export declare namespace AppUpdateResponse {
    interface SpectrumConfigAppConfig {
        /**
         * App identifier.
         */
        id: string;
        /**
         * When the Application was created.
         */
        created_on: string;
        /**
         * The name and type of DNS record for the Spectrum application.
         */
        dns: SpectrumAPI.DNS;
        /**
         * Enables IP Access Rules for this application. Notes: Only available for TCP
         * applications.
         */
        ip_firewall: boolean;
        /**
         * When the Application was last modified.
         */
        modified_on: string;
        /**
         * The port configuration at Cloudflare's edge. May specify a single port, for
         * example `"tcp/1000"`, or a range of ports, for example `"tcp/1000-2000"`.
         */
        protocol: string;
        /**
         * Enables Proxy Protocol to the origin. Refer to
         * [Enable Proxy protocol](https://developers.cloudflare.com/spectrum/getting-started/proxy-protocol/)
         * for implementation details on PROXY Protocol V1, PROXY Protocol V2, and Simple
         * Proxy Protocol.
         */
        proxy_protocol: 'off' | 'v1' | 'v2' | 'simple';
        /**
         * The type of TLS termination associated with the application.
         */
        tls: 'off' | 'flexible' | 'full' | 'strict';
        /**
         * Determines how data travels from the edge to your origin. When set to "direct",
         * Spectrum will send traffic directly to your origin, and the application's type
         * is derived from the `protocol`. When set to "http" or "https", Spectrum will
         * apply Cloudflare's HTTP/HTTPS features as it sends traffic to your origin, and
         * the application type matches this property exactly.
         */
        traffic_type: 'direct' | 'http' | 'https';
        /**
         * Enables Argo Smart Routing for this application. Notes: Only available for TCP
         * applications with traffic_type set to "direct".
         */
        argo_smart_routing?: boolean;
        /**
         * The anycast edge IP configuration for the hostname of this application.
         */
        edge_ips?: SpectrumAPI.EdgeIPs;
        /**
         * List of origin IP addresses. Array may contain multiple IP addresses for load
         * balancing.
         */
        origin_direct?: Array<string>;
        /**
         * The name and type of DNS record for the Spectrum application.
         */
        origin_dns?: SpectrumAPI.OriginDNS;
        /**
         * The destination port at the origin. Only specified in conjunction with
         * origin_dns. May use an integer to specify a single origin port, for example
         * `1000`, or a string to specify a range of origin ports, for example
         * `"1000-2000"`. Notes: If specifying a port range, the number of ports in the
         * range must match the number of ports specified in the "protocol" field.
         */
        origin_port?: SpectrumAPI.OriginPort;
    }
    interface SpectrumConfigPaygoAppConfig {
        /**
         * App identifier.
         */
        id: string;
        /**
         * When the Application was created.
         */
        created_on: string;
        /**
         * The name and type of DNS record for the Spectrum application.
         */
        dns: SpectrumAPI.DNS;
        /**
         * When the Application was last modified.
         */
        modified_on: string;
        /**
         * The port configuration at Cloudflare's edge. May specify a single port, for
         * example `"tcp/1000"`, or a range of ports, for example `"tcp/1000-2000"`.
         */
        protocol: string;
        /**
         * List of origin IP addresses. Array may contain multiple IP addresses for load
         * balancing.
         */
        origin_direct?: Array<string>;
    }
}
export type AppListResponse = Array<AppListResponse.UnionMember0> | Array<AppListResponse.UnionMember1>;
export declare namespace AppListResponse {
    interface UnionMember0 {
        /**
         * App identifier.
         */
        id: string;
        /**
         * When the Application was created.
         */
        created_on: string;
        /**
         * The name and type of DNS record for the Spectrum application.
         */
        dns: SpectrumAPI.DNS;
        /**
         * Enables IP Access Rules for this application. Notes: Only available for TCP
         * applications.
         */
        ip_firewall: boolean;
        /**
         * When the Application was last modified.
         */
        modified_on: string;
        /**
         * The port configuration at Cloudflare's edge. May specify a single port, for
         * example `"tcp/1000"`, or a range of ports, for example `"tcp/1000-2000"`.
         */
        protocol: string;
        /**
         * Enables Proxy Protocol to the origin. Refer to
         * [Enable Proxy protocol](https://developers.cloudflare.com/spectrum/getting-started/proxy-protocol/)
         * for implementation details on PROXY Protocol V1, PROXY Protocol V2, and Simple
         * Proxy Protocol.
         */
        proxy_protocol: 'off' | 'v1' | 'v2' | 'simple';
        /**
         * The type of TLS termination associated with the application.
         */
        tls: 'off' | 'flexible' | 'full' | 'strict';
        /**
         * Determines how data travels from the edge to your origin. When set to "direct",
         * Spectrum will send traffic directly to your origin, and the application's type
         * is derived from the `protocol`. When set to "http" or "https", Spectrum will
         * apply Cloudflare's HTTP/HTTPS features as it sends traffic to your origin, and
         * the application type matches this property exactly.
         */
        traffic_type: 'direct' | 'http' | 'https';
        /**
         * Enables Argo Smart Routing for this application. Notes: Only available for TCP
         * applications with traffic_type set to "direct".
         */
        argo_smart_routing?: boolean;
        /**
         * The anycast edge IP configuration for the hostname of this application.
         */
        edge_ips?: SpectrumAPI.EdgeIPs;
        /**
         * List of origin IP addresses. Array may contain multiple IP addresses for load
         * balancing.
         */
        origin_direct?: Array<string>;
        /**
         * The name and type of DNS record for the Spectrum application.
         */
        origin_dns?: SpectrumAPI.OriginDNS;
        /**
         * The destination port at the origin. Only specified in conjunction with
         * origin_dns. May use an integer to specify a single origin port, for example
         * `1000`, or a string to specify a range of origin ports, for example
         * `"1000-2000"`. Notes: If specifying a port range, the number of ports in the
         * range must match the number of ports specified in the "protocol" field.
         */
        origin_port?: SpectrumAPI.OriginPort;
    }
    interface UnionMember1 {
        /**
         * App identifier.
         */
        id: string;
        /**
         * When the Application was created.
         */
        created_on: string;
        /**
         * The name and type of DNS record for the Spectrum application.
         */
        dns: SpectrumAPI.DNS;
        /**
         * When the Application was last modified.
         */
        modified_on: string;
        /**
         * The port configuration at Cloudflare's edge. May specify a single port, for
         * example `"tcp/1000"`, or a range of ports, for example `"tcp/1000-2000"`.
         */
        protocol: string;
        /**
         * List of origin IP addresses. Array may contain multiple IP addresses for load
         * balancing.
         */
        origin_direct?: Array<string>;
    }
}
export interface AppDeleteResponse {
    /**
     * Identifier.
     */
    id: string;
}
export type AppGetResponse = AppGetResponse.SpectrumConfigAppConfig | AppGetResponse.SpectrumConfigPaygoAppConfig;
export declare namespace AppGetResponse {
    interface SpectrumConfigAppConfig {
        /**
         * App identifier.
         */
        id: string;
        /**
         * When the Application was created.
         */
        created_on: string;
        /**
         * The name and type of DNS record for the Spectrum application.
         */
        dns: SpectrumAPI.DNS;
        /**
         * Enables IP Access Rules for this application. Notes: Only available for TCP
         * applications.
         */
        ip_firewall: boolean;
        /**
         * When the Application was last modified.
         */
        modified_on: string;
        /**
         * The port configuration at Cloudflare's edge. May specify a single port, for
         * example `"tcp/1000"`, or a range of ports, for example `"tcp/1000-2000"`.
         */
        protocol: string;
        /**
         * Enables Proxy Protocol to the origin. Refer to
         * [Enable Proxy protocol](https://developers.cloudflare.com/spectrum/getting-started/proxy-protocol/)
         * for implementation details on PROXY Protocol V1, PROXY Protocol V2, and Simple
         * Proxy Protocol.
         */
        proxy_protocol: 'off' | 'v1' | 'v2' | 'simple';
        /**
         * The type of TLS termination associated with the application.
         */
        tls: 'off' | 'flexible' | 'full' | 'strict';
        /**
         * Determines how data travels from the edge to your origin. When set to "direct",
         * Spectrum will send traffic directly to your origin, and the application's type
         * is derived from the `protocol`. When set to "http" or "https", Spectrum will
         * apply Cloudflare's HTTP/HTTPS features as it sends traffic to your origin, and
         * the application type matches this property exactly.
         */
        traffic_type: 'direct' | 'http' | 'https';
        /**
         * Enables Argo Smart Routing for this application. Notes: Only available for TCP
         * applications with traffic_type set to "direct".
         */
        argo_smart_routing?: boolean;
        /**
         * The anycast edge IP configuration for the hostname of this application.
         */
        edge_ips?: SpectrumAPI.EdgeIPs;
        /**
         * List of origin IP addresses. Array may contain multiple IP addresses for load
         * balancing.
         */
        origin_direct?: Array<string>;
        /**
         * The name and type of DNS record for the Spectrum application.
         */
        origin_dns?: SpectrumAPI.OriginDNS;
        /**
         * The destination port at the origin. Only specified in conjunction with
         * origin_dns. May use an integer to specify a single origin port, for example
         * `1000`, or a string to specify a range of origin ports, for example
         * `"1000-2000"`. Notes: If specifying a port range, the number of ports in the
         * range must match the number of ports specified in the "protocol" field.
         */
        origin_port?: SpectrumAPI.OriginPort;
    }
    interface SpectrumConfigPaygoAppConfig {
        /**
         * App identifier.
         */
        id: string;
        /**
         * When the Application was created.
         */
        created_on: string;
        /**
         * The name and type of DNS record for the Spectrum application.
         */
        dns: SpectrumAPI.DNS;
        /**
         * When the Application was last modified.
         */
        modified_on: string;
        /**
         * The port configuration at Cloudflare's edge. May specify a single port, for
         * example `"tcp/1000"`, or a range of ports, for example `"tcp/1000-2000"`.
         */
        protocol: string;
        /**
         * List of origin IP addresses. Array may contain multiple IP addresses for load
         * balancing.
         */
        origin_direct?: Array<string>;
    }
}
export type AppCreateParams = AppCreateParams.SpectrumConfigAppConfig | AppCreateParams.SpectrumConfigPaygoAppConfig;
export declare namespace AppCreateParams {
    interface SpectrumConfigAppConfig {
        /**
         * Path param: Zone identifier.
         */
        zone_id: string;
        /**
         * Body param: The name and type of DNS record for the Spectrum application.
         */
        dns: SpectrumAPI.DNSParam;
        /**
         * Body param: Enables IP Access Rules for this application. Notes: Only available
         * for TCP applications.
         */
        ip_firewall: boolean;
        /**
         * Body param: The port configuration at Cloudflare's edge. May specify a single
         * port, for example `"tcp/1000"`, or a range of ports, for example
         * `"tcp/1000-2000"`.
         */
        protocol: string;
        /**
         * Body param: Enables Proxy Protocol to the origin. Refer to
         * [Enable Proxy protocol](https://developers.cloudflare.com/spectrum/getting-started/proxy-protocol/)
         * for implementation details on PROXY Protocol V1, PROXY Protocol V2, and Simple
         * Proxy Protocol.
         */
        proxy_protocol: 'off' | 'v1' | 'v2' | 'simple';
        /**
         * Body param: The type of TLS termination associated with the application.
         */
        tls: 'off' | 'flexible' | 'full' | 'strict';
        /**
         * Body param: Determines how data travels from the edge to your origin. When set
         * to "direct", Spectrum will send traffic directly to your origin, and the
         * application's type is derived from the `protocol`. When set to "http" or
         * "https", Spectrum will apply Cloudflare's HTTP/HTTPS features as it sends
         * traffic to your origin, and the application type matches this property exactly.
         */
        traffic_type: 'direct' | 'http' | 'https';
        /**
         * Body param: Enables Argo Smart Routing for this application. Notes: Only
         * available for TCP applications with traffic_type set to "direct".
         */
        argo_smart_routing?: boolean;
        /**
         * Body param: The anycast edge IP configuration for the hostname of this
         * application.
         */
        edge_ips?: SpectrumAPI.EdgeIPsParam;
        /**
         * Body param: List of origin IP addresses. Array may contain multiple IP addresses
         * for load balancing.
         */
        origin_direct?: Array<string>;
        /**
         * Body param: The name and type of DNS record for the Spectrum application.
         */
        origin_dns?: SpectrumAPI.OriginDNSParam;
        /**
         * Body param: The destination port at the origin. Only specified in conjunction
         * with origin_dns. May use an integer to specify a single origin port, for example
         * `1000`, or a string to specify a range of origin ports, for example
         * `"1000-2000"`. Notes: If specifying a port range, the number of ports in the
         * range must match the number of ports specified in the "protocol" field.
         */
        origin_port?: SpectrumAPI.OriginPortParam;
    }
    interface SpectrumConfigPaygoAppConfig {
        /**
         * Path param: Zone identifier.
         */
        zone_id: string;
        /**
         * Body param: The name and type of DNS record for the Spectrum application.
         */
        dns: SpectrumAPI.DNSParam;
        /**
         * Body param: The port configuration at Cloudflare's edge. May specify a single
         * port, for example `"tcp/1000"`, or a range of ports, for example
         * `"tcp/1000-2000"`.
         */
        protocol: string;
        /**
         * Body param: List of origin IP addresses. Array may contain multiple IP addresses
         * for load balancing.
         */
        origin_direct?: Array<string>;
    }
}
export type AppUpdateParams = AppUpdateParams.SpectrumConfigAppConfig | AppUpdateParams.SpectrumConfigPaygoAppConfig;
export declare namespace AppUpdateParams {
    interface SpectrumConfigAppConfig {
        /**
         * Path param: Zone identifier.
         */
        zone_id: string;
        /**
         * Body param: The name and type of DNS record for the Spectrum application.
         */
        dns: SpectrumAPI.DNSParam;
        /**
         * Body param: Enables IP Access Rules for this application. Notes: Only available
         * for TCP applications.
         */
        ip_firewall: boolean;
        /**
         * Body param: The port configuration at Cloudflare's edge. May specify a single
         * port, for example `"tcp/1000"`, or a range of ports, for example
         * `"tcp/1000-2000"`.
         */
        protocol: string;
        /**
         * Body param: Enables Proxy Protocol to the origin. Refer to
         * [Enable Proxy protocol](https://developers.cloudflare.com/spectrum/getting-started/proxy-protocol/)
         * for implementation details on PROXY Protocol V1, PROXY Protocol V2, and Simple
         * Proxy Protocol.
         */
        proxy_protocol: 'off' | 'v1' | 'v2' | 'simple';
        /**
         * Body param: The type of TLS termination associated with the application.
         */
        tls: 'off' | 'flexible' | 'full' | 'strict';
        /**
         * Body param: Determines how data travels from the edge to your origin. When set
         * to "direct", Spectrum will send traffic directly to your origin, and the
         * application's type is derived from the `protocol`. When set to "http" or
         * "https", Spectrum will apply Cloudflare's HTTP/HTTPS features as it sends
         * traffic to your origin, and the application type matches this property exactly.
         */
        traffic_type: 'direct' | 'http' | 'https';
        /**
         * Body param: Enables Argo Smart Routing for this application. Notes: Only
         * available for TCP applications with traffic_type set to "direct".
         */
        argo_smart_routing?: boolean;
        /**
         * Body param: The anycast edge IP configuration for the hostname of this
         * application.
         */
        edge_ips?: SpectrumAPI.EdgeIPsParam;
        /**
         * Body param: List of origin IP addresses. Array may contain multiple IP addresses
         * for load balancing.
         */
        origin_direct?: Array<string>;
        /**
         * Body param: The name and type of DNS record for the Spectrum application.
         */
        origin_dns?: SpectrumAPI.OriginDNSParam;
        /**
         * Body param: The destination port at the origin. Only specified in conjunction
         * with origin_dns. May use an integer to specify a single origin port, for example
         * `1000`, or a string to specify a range of origin ports, for example
         * `"1000-2000"`. Notes: If specifying a port range, the number of ports in the
         * range must match the number of ports specified in the "protocol" field.
         */
        origin_port?: SpectrumAPI.OriginPortParam;
    }
    interface SpectrumConfigPaygoAppConfig {
        /**
         * Path param: Zone identifier.
         */
        zone_id: string;
        /**
         * Body param: The name and type of DNS record for the Spectrum application.
         */
        dns: SpectrumAPI.DNSParam;
        /**
         * Body param: The port configuration at Cloudflare's edge. May specify a single
         * port, for example `"tcp/1000"`, or a range of ports, for example
         * `"tcp/1000-2000"`.
         */
        protocol: string;
        /**
         * Body param: List of origin IP addresses. Array may contain multiple IP addresses
         * for load balancing.
         */
        origin_direct?: Array<string>;
    }
}
export interface AppListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Zone identifier.
     */
    zone_id: string;
    /**
     * Query param: Sets the direction by which results are ordered.
     */
    direction?: 'asc' | 'desc';
    /**
     * Query param: Application field by which results are ordered.
     */
    order?: 'protocol' | 'app_id' | 'created_on' | 'modified_on' | 'dns';
}
export interface AppDeleteParams {
    /**
     * Zone identifier.
     */
    zone_id: string;
}
export interface AppGetParams {
    /**
     * Zone identifier.
     */
    zone_id: string;
}
export declare namespace Apps {
    export { type AppCreateResponse as AppCreateResponse, type AppUpdateResponse as AppUpdateResponse, type AppListResponse as AppListResponse, type AppDeleteResponse as AppDeleteResponse, type AppGetResponse as AppGetResponse, AppListResponsesV4PagePaginationArray as AppListResponsesV4PagePaginationArray, type AppCreateParams as AppCreateParams, type AppUpdateParams as AppUpdateParams, type AppListParams as AppListParams, type AppDeleteParams as AppDeleteParams, type AppGetParams as AppGetParams, };
}
//# sourceMappingURL=apps.d.ts.map