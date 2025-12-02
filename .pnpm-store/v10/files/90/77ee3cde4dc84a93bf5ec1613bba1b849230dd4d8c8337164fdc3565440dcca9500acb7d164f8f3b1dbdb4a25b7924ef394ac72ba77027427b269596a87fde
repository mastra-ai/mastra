import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as PCAPsAPI from "./pcaps.js";
import * as DownloadAPI from "./download.js";
import { Download, DownloadGetParams } from "./download.js";
import * as OwnershipAPI from "./ownership.js";
import { Ownership, OwnershipCreateParams, OwnershipDeleteParams, OwnershipGetParams, OwnershipResource, OwnershipValidateParams, OwnershipsSinglePage } from "./ownership.js";
import { SinglePage } from "../../../pagination.js";
export declare class PCAPs extends APIResource {
    ownership: OwnershipAPI.OwnershipResource;
    download: DownloadAPI.Download;
    /**
     * Create new PCAP request for account.
     *
     * @example
     * ```ts
     * const pcap = await client.magicTransit.pcaps.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   packet_limit: 10000,
     *   system: 'magic-transit',
     *   time_limit: 300,
     *   type: 'simple',
     * });
     * ```
     */
    create(params: PCAPCreateParams, options?: Core.RequestOptions): Core.APIPromise<PCAPCreateResponse>;
    /**
     * Lists all packet capture requests for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const pcapListResponse of client.magicTransit.pcaps.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: PCAPListParams, options?: Core.RequestOptions): Core.PagePromise<PCAPListResponsesSinglePage, PCAPListResponse>;
    /**
     * Get information for a PCAP request by id.
     *
     * @example
     * ```ts
     * const pcap = await client.magicTransit.pcaps.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(pcapId: string, params: PCAPGetParams, options?: Core.RequestOptions): Core.APIPromise<PCAPGetResponse>;
    /**
     * Stop full PCAP
     *
     * @example
     * ```ts
     * await client.magicTransit.pcaps.stop(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    stop(pcapId: string, params: PCAPStopParams, options?: Core.RequestOptions): Core.APIPromise<void>;
}
export declare class PCAPListResponsesSinglePage extends SinglePage<PCAPListResponse> {
}
export interface PCAP {
    /**
     * The ID for the packet capture.
     */
    id?: string;
    /**
     * The packet capture filter. When this field is empty, all packets are captured.
     */
    filter_v1?: PCAPFilter;
    /**
     * The RFC 3339 offset timestamp from which to query backwards for packets. Must be
     * within the last 24h. When this field is empty, defaults to time of request.
     */
    offset_time?: string;
    /**
     * The status of the packet capture request.
     */
    status?: 'unknown' | 'success' | 'pending' | 'running' | 'conversion_pending' | 'conversion_running' | 'complete' | 'failed';
    /**
     * The RFC 3339 timestamp when the packet capture was created.
     */
    submitted?: string;
    /**
     * The system used to collect packet captures.
     */
    system?: 'magic-transit';
    /**
     * The packet capture duration in seconds.
     */
    time_limit?: number;
    /**
     * The type of packet capture. `Simple` captures sampled packets, and `full`
     * captures entire payloads and non-sampled packets.
     */
    type?: 'simple' | 'full';
}
/**
 * The packet capture filter. When this field is empty, all packets are captured.
 */
export interface PCAPFilter {
    /**
     * The destination IP address of the packet.
     */
    destination_address?: string;
    /**
     * The destination port of the packet.
     */
    destination_port?: number;
    /**
     * The protocol number of the packet.
     */
    protocol?: number;
    /**
     * The source IP address of the packet.
     */
    source_address?: string;
    /**
     * The source port of the packet.
     */
    source_port?: number;
}
/**
 * The packet capture filter. When this field is empty, all packets are captured.
 */
export interface PCAPFilterParam {
    /**
     * The destination IP address of the packet.
     */
    destination_address?: string;
    /**
     * The destination port of the packet.
     */
    destination_port?: number;
    /**
     * The protocol number of the packet.
     */
    protocol?: number;
    /**
     * The source IP address of the packet.
     */
    source_address?: string;
    /**
     * The source port of the packet.
     */
    source_port?: number;
}
export type PCAPCreateResponse = PCAP | PCAPCreateResponse.MagicVisibilityPCAPsPCAPsResponseFull;
export declare namespace PCAPCreateResponse {
    interface MagicVisibilityPCAPsPCAPsResponseFull {
        /**
         * The ID for the packet capture.
         */
        id?: string;
        /**
         * The maximum number of bytes to capture. This field only applies to `full` packet
         * captures.
         */
        byte_limit?: number;
        /**
         * The name of the data center used for the packet capture. This can be a specific
         * colo (ord02) or a multi-colo name (ORD). This field only applies to `full`
         * packet captures.
         */
        colo_name?: string;
        /**
         * The full URI for the bucket. This field only applies to `full` packet captures.
         */
        destination_conf?: string;
        /**
         * An error message that describes why the packet capture failed. This field only
         * applies to `full` packet captures.
         */
        error_message?: string;
        /**
         * The packet capture filter. When this field is empty, all packets are captured.
         */
        filter_v1?: PCAPsAPI.PCAPFilter;
        /**
         * The number of packets captured.
         */
        packets_captured?: number;
        /**
         * The status of the packet capture request.
         */
        status?: 'unknown' | 'success' | 'pending' | 'running' | 'conversion_pending' | 'conversion_running' | 'complete' | 'failed';
        /**
         * The RFC 3339 timestamp when stopping the packet capture was requested. This
         * field only applies to `full` packet captures.
         */
        stop_requested?: string;
        /**
         * The RFC 3339 timestamp when the packet capture was created.
         */
        submitted?: string;
        /**
         * The system used to collect packet captures.
         */
        system?: 'magic-transit';
        /**
         * The packet capture duration in seconds.
         */
        time_limit?: number;
        /**
         * The type of packet capture. `Simple` captures sampled packets, and `full`
         * captures entire payloads and non-sampled packets.
         */
        type?: 'simple' | 'full';
    }
}
export type PCAPListResponse = PCAP | PCAPListResponse.MagicVisibilityPCAPsPCAPsResponseFull;
export declare namespace PCAPListResponse {
    interface MagicVisibilityPCAPsPCAPsResponseFull {
        /**
         * The ID for the packet capture.
         */
        id?: string;
        /**
         * The maximum number of bytes to capture. This field only applies to `full` packet
         * captures.
         */
        byte_limit?: number;
        /**
         * The name of the data center used for the packet capture. This can be a specific
         * colo (ord02) or a multi-colo name (ORD). This field only applies to `full`
         * packet captures.
         */
        colo_name?: string;
        /**
         * The full URI for the bucket. This field only applies to `full` packet captures.
         */
        destination_conf?: string;
        /**
         * An error message that describes why the packet capture failed. This field only
         * applies to `full` packet captures.
         */
        error_message?: string;
        /**
         * The packet capture filter. When this field is empty, all packets are captured.
         */
        filter_v1?: PCAPsAPI.PCAPFilter;
        /**
         * The number of packets captured.
         */
        packets_captured?: number;
        /**
         * The status of the packet capture request.
         */
        status?: 'unknown' | 'success' | 'pending' | 'running' | 'conversion_pending' | 'conversion_running' | 'complete' | 'failed';
        /**
         * The RFC 3339 timestamp when stopping the packet capture was requested. This
         * field only applies to `full` packet captures.
         */
        stop_requested?: string;
        /**
         * The RFC 3339 timestamp when the packet capture was created.
         */
        submitted?: string;
        /**
         * The system used to collect packet captures.
         */
        system?: 'magic-transit';
        /**
         * The packet capture duration in seconds.
         */
        time_limit?: number;
        /**
         * The type of packet capture. `Simple` captures sampled packets, and `full`
         * captures entire payloads and non-sampled packets.
         */
        type?: 'simple' | 'full';
    }
}
export type PCAPGetResponse = PCAP | PCAPGetResponse.MagicVisibilityPCAPsPCAPsResponseFull;
export declare namespace PCAPGetResponse {
    interface MagicVisibilityPCAPsPCAPsResponseFull {
        /**
         * The ID for the packet capture.
         */
        id?: string;
        /**
         * The maximum number of bytes to capture. This field only applies to `full` packet
         * captures.
         */
        byte_limit?: number;
        /**
         * The name of the data center used for the packet capture. This can be a specific
         * colo (ord02) or a multi-colo name (ORD). This field only applies to `full`
         * packet captures.
         */
        colo_name?: string;
        /**
         * The full URI for the bucket. This field only applies to `full` packet captures.
         */
        destination_conf?: string;
        /**
         * An error message that describes why the packet capture failed. This field only
         * applies to `full` packet captures.
         */
        error_message?: string;
        /**
         * The packet capture filter. When this field is empty, all packets are captured.
         */
        filter_v1?: PCAPsAPI.PCAPFilter;
        /**
         * The number of packets captured.
         */
        packets_captured?: number;
        /**
         * The status of the packet capture request.
         */
        status?: 'unknown' | 'success' | 'pending' | 'running' | 'conversion_pending' | 'conversion_running' | 'complete' | 'failed';
        /**
         * The RFC 3339 timestamp when stopping the packet capture was requested. This
         * field only applies to `full` packet captures.
         */
        stop_requested?: string;
        /**
         * The RFC 3339 timestamp when the packet capture was created.
         */
        submitted?: string;
        /**
         * The system used to collect packet captures.
         */
        system?: 'magic-transit';
        /**
         * The packet capture duration in seconds.
         */
        time_limit?: number;
        /**
         * The type of packet capture. `Simple` captures sampled packets, and `full`
         * captures entire payloads and non-sampled packets.
         */
        type?: 'simple' | 'full';
    }
}
export type PCAPCreateParams = PCAPCreateParams.MagicVisibilityPCAPsPCAPsRequestSimple | PCAPCreateParams.MagicVisibilityPCAPsPCAPsRequestFull;
export declare namespace PCAPCreateParams {
    interface MagicVisibilityPCAPsPCAPsRequestSimple {
        /**
         * Path param: Identifier
         */
        account_id: string;
        /**
         * Body param: The limit of packets contained in a packet capture.
         */
        packet_limit: number;
        /**
         * Body param: The system used to collect packet captures.
         */
        system: 'magic-transit';
        /**
         * Body param: The packet capture duration in seconds.
         */
        time_limit: number;
        /**
         * Body param: The type of packet capture. `Simple` captures sampled packets, and
         * `full` captures entire payloads and non-sampled packets.
         */
        type: 'simple' | 'full';
        /**
         * Body param: The packet capture filter. When this field is empty, all packets are
         * captured.
         */
        filter_v1?: PCAPFilterParam;
        /**
         * Body param: The RFC 3339 offset timestamp from which to query backwards for
         * packets. Must be within the last 24h. When this field is empty, defaults to time
         * of request.
         */
        offset_time?: string;
    }
    interface MagicVisibilityPCAPsPCAPsRequestFull {
        /**
         * Path param: Identifier
         */
        account_id: string;
        /**
         * Body param: The name of the data center used for the packet capture. This can be
         * a specific colo (ord02) or a multi-colo name (ORD). This field only applies to
         * `full` packet captures.
         */
        colo_name: string;
        /**
         * Body param: The full URI for the bucket. This field only applies to `full`
         * packet captures.
         */
        destination_conf: string;
        /**
         * Body param: The system used to collect packet captures.
         */
        system: 'magic-transit';
        /**
         * Body param: The packet capture duration in seconds.
         */
        time_limit: number;
        /**
         * Body param: The type of packet capture. `Simple` captures sampled packets, and
         * `full` captures entire payloads and non-sampled packets.
         */
        type: 'simple' | 'full';
        /**
         * Body param: The maximum number of bytes to capture. This field only applies to
         * `full` packet captures.
         */
        byte_limit?: number;
        /**
         * Body param: The packet capture filter. When this field is empty, all packets are
         * captured.
         */
        filter_v1?: PCAPFilterParam;
        /**
         * Body param: The limit of packets contained in a packet capture.
         */
        packet_limit?: number;
    }
}
export interface PCAPListParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface PCAPGetParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface PCAPStopParams {
    /**
     * Identifier
     */
    account_id: string;
}
export declare namespace PCAPs {
    export { type PCAP as PCAP, type PCAPFilter as PCAPFilter, type PCAPCreateResponse as PCAPCreateResponse, type PCAPListResponse as PCAPListResponse, type PCAPGetResponse as PCAPGetResponse, PCAPListResponsesSinglePage as PCAPListResponsesSinglePage, type PCAPCreateParams as PCAPCreateParams, type PCAPListParams as PCAPListParams, type PCAPGetParams as PCAPGetParams, type PCAPStopParams as PCAPStopParams, };
    export { OwnershipResource as OwnershipResource, type Ownership as Ownership, OwnershipsSinglePage as OwnershipsSinglePage, type OwnershipCreateParams as OwnershipCreateParams, type OwnershipDeleteParams as OwnershipDeleteParams, type OwnershipGetParams as OwnershipGetParams, type OwnershipValidateParams as OwnershipValidateParams, };
    export { Download as Download, type DownloadGetParams as DownloadGetParams };
}
//# sourceMappingURL=pcaps.d.ts.map