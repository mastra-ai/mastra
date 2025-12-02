import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class Traceroutes extends APIResource {
    /**
     * Run traceroutes from Cloudflare colos.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const traceroute of client.diagnostics.traceroutes.create(
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     targets: ['203.0.113.1', 'cloudflare.com'],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    create(params: TracerouteCreateParams, options?: Core.RequestOptions): Core.PagePromise<TraceroutesSinglePage, Traceroute>;
}
export declare class TraceroutesSinglePage extends SinglePage<Traceroute> {
}
export interface Traceroute {
    colos?: Array<Traceroute.Colo>;
    /**
     * The target hostname, IPv6, or IPv6 address.
     */
    target?: string;
}
export declare namespace Traceroute {
    interface Colo {
        colo?: Colo.Colo;
        /**
         * Errors resulting from collecting traceroute from colo to target.
         */
        error?: '' | 'Could not gather traceroute data: Code 1' | 'Could not gather traceroute data: Code 2' | 'Could not gather traceroute data: Code 3' | 'Could not gather traceroute data: Code 4';
        hops?: Array<Colo.Hop>;
        /**
         * Aggregated statistics from all hops about the target.
         */
        target_summary?: unknown;
        /**
         * Total time of traceroute in ms.
         */
        traceroute_time_ms?: number;
    }
    namespace Colo {
        interface Colo {
            /**
             * Source colo city.
             */
            city?: string;
            /**
             * Source colo name.
             */
            name?: string;
        }
        interface Hop {
            /**
             * An array of node objects.
             */
            nodes?: Array<Hop.Node>;
            /**
             * Number of packets where no response was received.
             */
            packets_lost?: number;
            /**
             * Number of packets sent with specified TTL.
             */
            packets_sent?: number;
            /**
             * The time to live (TTL).
             */
            packets_ttl?: number;
        }
        namespace Hop {
            interface Node {
                /**
                 * AS number associated with the node object.
                 */
                asn?: string;
                /**
                 * IP address of the node.
                 */
                ip?: string;
                /**
                 * Field appears if there is an additional annotation printed when the probe
                 * returns. Field also appears when running a GRE+ICMP traceroute to denote which
                 * traceroute a node comes from.
                 */
                labels?: Array<string>;
                /**
                 * Maximum RTT in ms.
                 */
                max_rtt_ms?: number;
                /**
                 * Mean RTT in ms.
                 */
                mean_rtt_ms?: number;
                /**
                 * Minimum RTT in ms.
                 */
                min_rtt_ms?: number;
                /**
                 * Host name of the address, this may be the same as the IP address.
                 */
                name?: string;
                /**
                 * Number of packets with a response from this node.
                 */
                packet_count?: number;
                /**
                 * Standard deviation of the RTTs in ms.
                 */
                std_dev_rtt_ms?: number;
            }
        }
    }
}
export interface TracerouteCreateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param:
     */
    targets: Array<string>;
    /**
     * Body param: If no source colo names specified, all colos will be used. China
     * colos are unavailable for traceroutes.
     */
    colos?: Array<string>;
    /**
     * Body param:
     */
    options?: TracerouteCreateParams.Options;
}
export declare namespace TracerouteCreateParams {
    interface Options {
        /**
         * Max TTL.
         */
        max_ttl?: number;
        /**
         * Type of packet sent.
         */
        packet_type?: 'icmp' | 'tcp' | 'udp' | 'gre' | 'gre+icmp';
        /**
         * Number of packets sent at each TTL.
         */
        packets_per_ttl?: number;
        /**
         * For UDP and TCP, specifies the destination port. For ICMP, specifies the initial
         * ICMP sequence value. Default value 0 will choose the best value to use for each
         * protocol.
         */
        port?: number;
        /**
         * Set the time (in seconds) to wait for a response to a probe.
         */
        wait_time?: number;
    }
}
export declare namespace Traceroutes {
    export { type Traceroute as Traceroute, TraceroutesSinglePage as TraceroutesSinglePage, type TracerouteCreateParams as TracerouteCreateParams, };
}
//# sourceMappingURL=traceroutes.d.ts.map