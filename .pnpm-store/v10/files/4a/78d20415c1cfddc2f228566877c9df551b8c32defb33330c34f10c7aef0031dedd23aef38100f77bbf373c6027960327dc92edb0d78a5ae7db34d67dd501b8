import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as MagicTransitAPI from "./magic-transit.js";
export declare class CfInterconnects extends APIResource {
    /**
     * Updates a specific interconnect associated with an account. Use
     * `?validate_only=true` as an optional query parameter to only run validation
     * without persisting changes.
     *
     * @example
     * ```ts
     * const cfInterconnect =
     *   await client.magicTransit.cfInterconnects.update(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    update(cfInterconnectId: string, params: CfInterconnectUpdateParams, options?: Core.RequestOptions): Core.APIPromise<CfInterconnectUpdateResponse>;
    /**
     * Lists interconnects associated with an account.
     *
     * @example
     * ```ts
     * const cfInterconnects =
     *   await client.magicTransit.cfInterconnects.list({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    list(params: CfInterconnectListParams, options?: Core.RequestOptions): Core.APIPromise<CfInterconnectListResponse>;
    /**
     * Updates multiple interconnects associated with an account. Use
     * `?validate_only=true` as an optional query parameter to only run validation
     * without persisting changes.
     *
     * @example
     * ```ts
     * const response =
     *   await client.magicTransit.cfInterconnects.bulkUpdate({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: {},
     *   });
     * ```
     */
    bulkUpdate(params: CfInterconnectBulkUpdateParams, options?: Core.RequestOptions): Core.APIPromise<CfInterconnectBulkUpdateResponse>;
    /**
     * Lists details for a specific interconnect.
     *
     * @example
     * ```ts
     * const cfInterconnect =
     *   await client.magicTransit.cfInterconnects.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(cfInterconnectId: string, params: CfInterconnectGetParams, options?: Core.RequestOptions): Core.APIPromise<CfInterconnectGetResponse>;
}
export interface CfInterconnectUpdateResponse {
    modified?: boolean;
    modified_interconnect?: CfInterconnectUpdateResponse.ModifiedInterconnect;
}
export declare namespace CfInterconnectUpdateResponse {
    interface ModifiedInterconnect {
        /**
         * Identifier
         */
        id?: string;
        /**
         * The name of the interconnect. The name cannot share a name with other tunnels.
         */
        colo_name?: string;
        /**
         * The date and time the tunnel was created.
         */
        created_on?: string;
        /**
         * An optional description of the interconnect.
         */
        description?: string;
        /**
         * The configuration specific to GRE interconnects.
         */
        gre?: ModifiedInterconnect.GRE;
        health_check?: MagicTransitAPI.HealthCheck;
        /**
         * A 31-bit prefix (/31 in CIDR notation) supporting two hosts, one for each side
         * of the tunnel. Select the subnet from the following private IP space:
         * 10.0.0.0–10.255.255.255, 172.16.0.0–172.31.255.255, 192.168.0.0–192.168.255.255.
         */
        interface_address?: string;
        /**
         * The date and time the tunnel was last modified.
         */
        modified_on?: string;
        /**
         * The Maximum Transmission Unit (MTU) in bytes for the interconnect. The minimum
         * value is 576.
         */
        mtu?: number;
        /**
         * The name of the interconnect. The name cannot share a name with other tunnels.
         */
        name?: string;
    }
    namespace ModifiedInterconnect {
        /**
         * The configuration specific to GRE interconnects.
         */
        interface GRE {
            /**
             * The IP address assigned to the Cloudflare side of the GRE tunnel created as part
             * of the Interconnect.
             */
            cloudflare_endpoint?: string;
        }
    }
}
export interface CfInterconnectListResponse {
    interconnects?: Array<CfInterconnectListResponse.Interconnect>;
}
export declare namespace CfInterconnectListResponse {
    interface Interconnect {
        /**
         * Identifier
         */
        id?: string;
        /**
         * The name of the interconnect. The name cannot share a name with other tunnels.
         */
        colo_name?: string;
        /**
         * The date and time the tunnel was created.
         */
        created_on?: string;
        /**
         * An optional description of the interconnect.
         */
        description?: string;
        /**
         * The configuration specific to GRE interconnects.
         */
        gre?: Interconnect.GRE;
        health_check?: MagicTransitAPI.HealthCheck;
        /**
         * A 31-bit prefix (/31 in CIDR notation) supporting two hosts, one for each side
         * of the tunnel. Select the subnet from the following private IP space:
         * 10.0.0.0–10.255.255.255, 172.16.0.0–172.31.255.255, 192.168.0.0–192.168.255.255.
         */
        interface_address?: string;
        /**
         * The date and time the tunnel was last modified.
         */
        modified_on?: string;
        /**
         * The Maximum Transmission Unit (MTU) in bytes for the interconnect. The minimum
         * value is 576.
         */
        mtu?: number;
        /**
         * The name of the interconnect. The name cannot share a name with other tunnels.
         */
        name?: string;
    }
    namespace Interconnect {
        /**
         * The configuration specific to GRE interconnects.
         */
        interface GRE {
            /**
             * The IP address assigned to the Cloudflare side of the GRE tunnel created as part
             * of the Interconnect.
             */
            cloudflare_endpoint?: string;
        }
    }
}
export interface CfInterconnectBulkUpdateResponse {
    modified?: boolean;
    modified_interconnects?: Array<CfInterconnectBulkUpdateResponse.ModifiedInterconnect>;
}
export declare namespace CfInterconnectBulkUpdateResponse {
    interface ModifiedInterconnect {
        /**
         * Identifier
         */
        id?: string;
        /**
         * The name of the interconnect. The name cannot share a name with other tunnels.
         */
        colo_name?: string;
        /**
         * The date and time the tunnel was created.
         */
        created_on?: string;
        /**
         * An optional description of the interconnect.
         */
        description?: string;
        /**
         * The configuration specific to GRE interconnects.
         */
        gre?: ModifiedInterconnect.GRE;
        health_check?: MagicTransitAPI.HealthCheck;
        /**
         * A 31-bit prefix (/31 in CIDR notation) supporting two hosts, one for each side
         * of the tunnel. Select the subnet from the following private IP space:
         * 10.0.0.0–10.255.255.255, 172.16.0.0–172.31.255.255, 192.168.0.0–192.168.255.255.
         */
        interface_address?: string;
        /**
         * The date and time the tunnel was last modified.
         */
        modified_on?: string;
        /**
         * The Maximum Transmission Unit (MTU) in bytes for the interconnect. The minimum
         * value is 576.
         */
        mtu?: number;
        /**
         * The name of the interconnect. The name cannot share a name with other tunnels.
         */
        name?: string;
    }
    namespace ModifiedInterconnect {
        /**
         * The configuration specific to GRE interconnects.
         */
        interface GRE {
            /**
             * The IP address assigned to the Cloudflare side of the GRE tunnel created as part
             * of the Interconnect.
             */
            cloudflare_endpoint?: string;
        }
    }
}
export interface CfInterconnectGetResponse {
    interconnect?: CfInterconnectGetResponse.Interconnect;
}
export declare namespace CfInterconnectGetResponse {
    interface Interconnect {
        /**
         * Identifier
         */
        id?: string;
        /**
         * The name of the interconnect. The name cannot share a name with other tunnels.
         */
        colo_name?: string;
        /**
         * The date and time the tunnel was created.
         */
        created_on?: string;
        /**
         * An optional description of the interconnect.
         */
        description?: string;
        /**
         * The configuration specific to GRE interconnects.
         */
        gre?: Interconnect.GRE;
        health_check?: MagicTransitAPI.HealthCheck;
        /**
         * A 31-bit prefix (/31 in CIDR notation) supporting two hosts, one for each side
         * of the tunnel. Select the subnet from the following private IP space:
         * 10.0.0.0–10.255.255.255, 172.16.0.0–172.31.255.255, 192.168.0.0–192.168.255.255.
         */
        interface_address?: string;
        /**
         * The date and time the tunnel was last modified.
         */
        modified_on?: string;
        /**
         * The Maximum Transmission Unit (MTU) in bytes for the interconnect. The minimum
         * value is 576.
         */
        mtu?: number;
        /**
         * The name of the interconnect. The name cannot share a name with other tunnels.
         */
        name?: string;
    }
    namespace Interconnect {
        /**
         * The configuration specific to GRE interconnects.
         */
        interface GRE {
            /**
             * The IP address assigned to the Cloudflare side of the GRE tunnel created as part
             * of the Interconnect.
             */
            cloudflare_endpoint?: string;
        }
    }
}
export interface CfInterconnectUpdateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: An optional description of the interconnect.
     */
    description?: string;
    /**
     * Body param: The configuration specific to GRE interconnects.
     */
    gre?: CfInterconnectUpdateParams.GRE;
    /**
     * Body param:
     */
    health_check?: MagicTransitAPI.HealthCheckParam;
    /**
     * Body param: A 31-bit prefix (/31 in CIDR notation) supporting two hosts, one for
     * each side of the tunnel. Select the subnet from the following private IP space:
     * 10.0.0.0–10.255.255.255, 172.16.0.0–172.31.255.255, 192.168.0.0–192.168.255.255.
     */
    interface_address?: string;
    /**
     * Body param: The Maximum Transmission Unit (MTU) in bytes for the interconnect.
     * The minimum value is 576.
     */
    mtu?: number;
    /**
     * Header param: If true, the health check target in the request and response
     * bodies will be presented using the new object format. Defaults to false.
     */
    'x-magic-new-hc-target'?: boolean;
}
export declare namespace CfInterconnectUpdateParams {
    /**
     * The configuration specific to GRE interconnects.
     */
    interface GRE {
        /**
         * The IP address assigned to the Cloudflare side of the GRE tunnel created as part
         * of the Interconnect.
         */
        cloudflare_endpoint?: string;
    }
}
export interface CfInterconnectListParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Header param: If true, the health check target in the response body will be
     * presented using the new object format. Defaults to false.
     */
    'x-magic-new-hc-target'?: boolean;
}
export interface CfInterconnectBulkUpdateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param:
     */
    body: unknown;
    /**
     * Header param: If true, the health check target in the request and response
     * bodies will be presented using the new object format. Defaults to false.
     */
    'x-magic-new-hc-target'?: boolean;
}
export interface CfInterconnectGetParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Header param: If true, the health check target in the response body will be
     * presented using the new object format. Defaults to false.
     */
    'x-magic-new-hc-target'?: boolean;
}
export declare namespace CfInterconnects {
    export { type CfInterconnectUpdateResponse as CfInterconnectUpdateResponse, type CfInterconnectListResponse as CfInterconnectListResponse, type CfInterconnectBulkUpdateResponse as CfInterconnectBulkUpdateResponse, type CfInterconnectGetResponse as CfInterconnectGetResponse, type CfInterconnectUpdateParams as CfInterconnectUpdateParams, type CfInterconnectListParams as CfInterconnectListParams, type CfInterconnectBulkUpdateParams as CfInterconnectBulkUpdateParams, type CfInterconnectGetParams as CfInterconnectGetParams, };
}
//# sourceMappingURL=cf-interconnects.d.ts.map