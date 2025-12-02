import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as LatestAPI from "./latest.js";
import { Latest, LatestListParams, LatestListResponse } from "./latest.js";
export declare class Snapshots extends APIResource {
    latest: LatestAPI.Latest;
    /**
     * List Snapshots
     *
     * @example
     * ```ts
     * const snapshots =
     *   await client.magicTransit.connectors.snapshots.list(
     *     'connector_id',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       from: 0,
     *       to: 0,
     *     },
     *   );
     * ```
     */
    list(connectorId: string, params: SnapshotListParams, options?: Core.RequestOptions): Core.APIPromise<SnapshotListResponse>;
    /**
     * Get Snapshot
     *
     * @example
     * ```ts
     * const snapshot =
     *   await client.magicTransit.connectors.snapshots.get(
     *     'connector_id',
     *     0,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(connectorId: string, snapshotT: number, params: SnapshotGetParams, options?: Core.RequestOptions): Core.APIPromise<SnapshotGetResponse>;
}
export interface SnapshotListResponse {
    count: number;
    items: Array<SnapshotListResponse.Item>;
    cursor?: string;
}
export declare namespace SnapshotListResponse {
    interface Item {
        /**
         * Time the Snapshot was collected (seconds since the Unix epoch)
         */
        a: number;
        /**
         * Time the Snapshot was recorded (seconds since the Unix epoch)
         */
        t: number;
    }
}
/**
 * Snapshot
 */
export interface SnapshotGetResponse {
    /**
     * Count of failures to reclaim space
     */
    count_reclaim_failures: number;
    /**
     * Count of reclaimed paths
     */
    count_reclaimed_paths: number;
    /**
     * Count of failed snapshot recordings
     */
    count_record_failed: number;
    /**
     * Count of failed snapshot transmissions
     */
    count_transmit_failures: number;
    /**
     * Time the Snapshot was recorded (seconds since the Unix epoch)
     */
    t: number;
    /**
     * Version
     */
    v: string;
    /**
     * Count of processors/cores
     */
    cpu_count?: number;
    /**
     * Percentage of time over a 10 second window that tasks were stalled
     */
    cpu_pressure_10s?: number;
    /**
     * Percentage of time over a 5 minute window that tasks were stalled
     */
    cpu_pressure_300s?: number;
    /**
     * Percentage of time over a 1 minute window that tasks were stalled
     */
    cpu_pressure_60s?: number;
    /**
     * Total stall time (microseconds)
     */
    cpu_pressure_total_us?: number;
    /**
     * Time spent running a virtual CPU or guest OS (milliseconds)
     */
    cpu_time_guest_ms?: number;
    /**
     * Time spent running a niced guest (milliseconds)
     */
    cpu_time_guest_nice_ms?: number;
    /**
     * Time spent in idle state (milliseconds)
     */
    cpu_time_idle_ms?: number;
    /**
     * Time spent wait for I/O to complete (milliseconds)
     */
    cpu_time_iowait_ms?: number;
    /**
     * Time spent servicing interrupts (milliseconds)
     */
    cpu_time_irq_ms?: number;
    /**
     * Time spent in low-priority user mode (milliseconds)
     */
    cpu_time_nice_ms?: number;
    /**
     * Time spent servicing softirqs (milliseconds)
     */
    cpu_time_softirq_ms?: number;
    /**
     * Time stolen (milliseconds)
     */
    cpu_time_steal_ms?: number;
    /**
     * Time spent in system mode (milliseconds)
     */
    cpu_time_system_ms?: number;
    /**
     * Time spent in user mode (milliseconds)
     */
    cpu_time_user_ms?: number;
    dhcp_leases?: Array<SnapshotGetResponse.DHCPLease>;
    disks?: Array<SnapshotGetResponse.Disk>;
    /**
     * Name of high availability state
     */
    ha_state?: string;
    /**
     * Numeric value associated with high availability state (0 = disabled, 1 = active,
     * 2 = standby, 3 = stopped, 4 = fault)
     */
    ha_value?: number;
    interfaces?: Array<SnapshotGetResponse.Interface>;
    /**
     * Percentage of time over a 10 second window that all tasks were stalled
     */
    io_pressure_full_10s?: number;
    /**
     * Percentage of time over a 5 minute window that all tasks were stalled
     */
    io_pressure_full_300s?: number;
    /**
     * Percentage of time over a 1 minute window that all tasks were stalled
     */
    io_pressure_full_60s?: number;
    /**
     * Total stall time (microseconds)
     */
    io_pressure_full_total_us?: number;
    /**
     * Percentage of time over a 10 second window that some tasks were stalled
     */
    io_pressure_some_10s?: number;
    /**
     * Percentage of time over a 3 minute window that some tasks were stalled
     */
    io_pressure_some_300s?: number;
    /**
     * Percentage of time over a 1 minute window that some tasks were stalled
     */
    io_pressure_some_60s?: number;
    /**
     * Total stall time (microseconds)
     */
    io_pressure_some_total_us?: number;
    /**
     * Boot time (seconds since Unix epoch)
     */
    kernel_btime?: number;
    /**
     * Number of context switches that the system underwent
     */
    kernel_ctxt?: number;
    /**
     * Number of forks since boot
     */
    kernel_processes?: number;
    /**
     * Number of processes blocked waiting for I/O
     */
    kernel_processes_blocked?: number;
    /**
     * Number of processes in runnable state
     */
    kernel_processes_running?: number;
    /**
     * The fifteen-minute load average
     */
    load_average_15m?: number;
    /**
     * The one-minute load average
     */
    load_average_1m?: number;
    /**
     * The five-minute load average
     */
    load_average_5m?: number;
    /**
     * Number of currently runnable kernel scheduling entities
     */
    load_average_cur?: number;
    /**
     * Number of kernel scheduling entities that currently exist on the system
     */
    load_average_max?: number;
    /**
     * Memory that has been used more recently
     */
    memory_active_bytes?: number;
    /**
     * Non-file backed huge pages mapped into user-space page tables
     */
    memory_anon_hugepages_bytes?: number;
    /**
     * Non-file backed pages mapped into user-space page tables
     */
    memory_anon_pages_bytes?: number;
    /**
     * Estimate of how much memory is available for starting new applications
     */
    memory_available_bytes?: number;
    /**
     * Memory used for block device bounce buffers
     */
    memory_bounce_bytes?: number;
    /**
     * Relatively temporary storage for raw disk blocks
     */
    memory_buffers_bytes?: number;
    /**
     * In-memory cache for files read from the disk
     */
    memory_cached_bytes?: number;
    /**
     * Free CMA (Contiguous Memory Allocator) pages
     */
    memory_cma_free_bytes?: number;
    /**
     * Total CMA (Contiguous Memory Allocator) pages
     */
    memory_cma_total_bytes?: number;
    /**
     * Total amount of memory currently available to be allocated on the system
     */
    memory_commit_limit_bytes?: number;
    /**
     * Amount of memory presently allocated on the system
     */
    memory_committed_as_bytes?: number;
    /**
     * Memory which is waiting to get written back to the disk
     */
    memory_dirty_bytes?: number;
    /**
     * The sum of LowFree and HighFree
     */
    memory_free_bytes?: number;
    /**
     * Amount of free highmem
     */
    memory_high_free_bytes?: number;
    /**
     * Total amount of highmem
     */
    memory_high_total_bytes?: number;
    /**
     * The number of huge pages in the pool that are not yet allocated
     */
    memory_hugepages_free?: number;
    /**
     * Number of huge pages for which a commitment has been made, but no allocation has
     * yet been made
     */
    memory_hugepages_rsvd?: number;
    /**
     * Number of huge pages in the pool above the threshold
     */
    memory_hugepages_surp?: number;
    /**
     * The size of the pool of huge pages
     */
    memory_hugepages_total?: number;
    /**
     * The size of huge pages
     */
    memory_hugepagesize_bytes?: number;
    /**
     * Memory which has been less recently used
     */
    memory_inactive_bytes?: number;
    /**
     * Kernel allocations that the kernel will attempt to reclaim under memory pressure
     */
    memory_k_reclaimable_bytes?: number;
    /**
     * Amount of memory allocated to kernel stacks
     */
    memory_kernel_stack_bytes?: number;
    /**
     * Amount of free lowmem
     */
    memory_low_free_bytes?: number;
    /**
     * Total amount of lowmem
     */
    memory_low_total_bytes?: number;
    /**
     * Files which have been mapped into memory
     */
    memory_mapped_bytes?: number;
    /**
     * Amount of memory dedicated to the lowest level of page tables
     */
    memory_page_tables_bytes?: number;
    /**
     * Memory allocated to the per-cpu alloctor used to back per-cpu allocations
     */
    memory_per_cpu_bytes?: number;
    /**
     * Percentage of time over a 10 second window that all tasks were stalled
     */
    memory_pressure_full_10s?: number;
    /**
     * Percentage of time over a 5 minute window that all tasks were stalled
     */
    memory_pressure_full_300s?: number;
    /**
     * Percentage of time over a 1 minute window that all tasks were stalled
     */
    memory_pressure_full_60s?: number;
    /**
     * Total stall time (microseconds)
     */
    memory_pressure_full_total_us?: number;
    /**
     * Percentage of time over a 10 second window that some tasks were stalled
     */
    memory_pressure_some_10s?: number;
    /**
     * Percentage of time over a 5 minute window that some tasks were stalled
     */
    memory_pressure_some_300s?: number;
    /**
     * Percentage of time over a 1 minute window that some tasks were stalled
     */
    memory_pressure_some_60s?: number;
    /**
     * Total stall time (microseconds)
     */
    memory_pressure_some_total_us?: number;
    /**
     * Part of slab that can be reclaimed on memory pressure
     */
    memory_s_reclaimable_bytes?: number;
    /**
     * Part of slab that cannot be reclaimed on memory pressure
     */
    memory_s_unreclaim_bytes?: number;
    /**
     * Amount of memory dedicated to the lowest level of page tables
     */
    memory_secondary_page_tables_bytes?: number;
    /**
     * Amount of memory consumed by tmpfs
     */
    memory_shmem_bytes?: number;
    /**
     * Memory used by shmem and tmpfs, allocated with huge pages
     */
    memory_shmem_hugepages_bytes?: number;
    /**
     * Shared memory mapped into user space with huge pages
     */
    memory_shmem_pmd_mapped_bytes?: number;
    /**
     * In-kernel data structures cache
     */
    memory_slab_bytes?: number;
    /**
     * Memory swapped out and back in while still in swap file
     */
    memory_swap_cached_bytes?: number;
    /**
     * Amount of swap space that is currently unused
     */
    memory_swap_free_bytes?: number;
    /**
     * Total amount of swap space available
     */
    memory_swap_total_bytes?: number;
    /**
     * Total usable RAM
     */
    memory_total_bytes?: number;
    /**
     * Largest contiguous block of vmalloc area which is free
     */
    memory_vmalloc_chunk_bytes?: number;
    /**
     * Total size of vmalloc memory area
     */
    memory_vmalloc_total_bytes?: number;
    /**
     * Amount of vmalloc area which is used
     */
    memory_vmalloc_used_bytes?: number;
    /**
     * Memory which is actively being written back to the disk
     */
    memory_writeback_bytes?: number;
    /**
     * Memory used by FUSE for temporary writeback buffers
     */
    memory_writeback_tmp_bytes?: number;
    /**
     * Memory consumed by the zswap backend, compressed
     */
    memory_z_swap_bytes?: number;
    /**
     * Amount of anonymous memory stored in zswap, uncompressed
     */
    memory_z_swapped_bytes?: number;
    mounts?: Array<SnapshotGetResponse.Mount>;
    netdevs?: Array<SnapshotGetResponse.Netdev>;
    /**
     * Number of ICMP Address Mask Reply messages received
     */
    snmp_icmp_in_addr_mask_reps?: number;
    /**
     * Number of ICMP Address Mask Request messages received
     */
    snmp_icmp_in_addr_masks?: number;
    /**
     * Number of ICMP messages received with bad checksums
     */
    snmp_icmp_in_csum_errors?: number;
    /**
     * Number of ICMP Destination Unreachable messages received
     */
    snmp_icmp_in_dest_unreachs?: number;
    /**
     * Number of ICMP Echo Reply messages received
     */
    snmp_icmp_in_echo_reps?: number;
    /**
     * Number of ICMP Echo (request) messages received
     */
    snmp_icmp_in_echos?: number;
    /**
     * Number of ICMP messages received with ICMP-specific errors
     */
    snmp_icmp_in_errors?: number;
    /**
     * Number of ICMP messages received
     */
    snmp_icmp_in_msgs?: number;
    /**
     * Number of ICMP Parameter Problem messages received
     */
    snmp_icmp_in_parm_probs?: number;
    /**
     * Number of ICMP Redirect messages received
     */
    snmp_icmp_in_redirects?: number;
    /**
     * Number of ICMP Source Quench messages received
     */
    snmp_icmp_in_src_quenchs?: number;
    /**
     * Number of ICMP Time Exceeded messages received
     */
    snmp_icmp_in_time_excds?: number;
    /**
     * Number of ICMP Address Mask Request messages received
     */
    snmp_icmp_in_timestamp_reps?: number;
    /**
     * Number of ICMP Timestamp (request) messages received
     */
    snmp_icmp_in_timestamps?: number;
    /**
     * Number of ICMP Address Mask Reply messages sent
     */
    snmp_icmp_out_addr_mask_reps?: number;
    /**
     * Number of ICMP Address Mask Request messages sent
     */
    snmp_icmp_out_addr_masks?: number;
    /**
     * Number of ICMP Destination Unreachable messages sent
     */
    snmp_icmp_out_dest_unreachs?: number;
    /**
     * Number of ICMP Echo Reply messages sent
     */
    snmp_icmp_out_echo_reps?: number;
    /**
     * Number of ICMP Echo (request) messages sent
     */
    snmp_icmp_out_echos?: number;
    /**
     * Number of ICMP messages which this entity did not send due to ICMP-specific
     * errors
     */
    snmp_icmp_out_errors?: number;
    /**
     * Number of ICMP messages attempted to send
     */
    snmp_icmp_out_msgs?: number;
    /**
     * Number of ICMP Parameter Problem messages sent
     */
    snmp_icmp_out_parm_probs?: number;
    /**
     * Number of ICMP Redirect messages sent
     */
    snmp_icmp_out_redirects?: number;
    /**
     * Number of ICMP Source Quench messages sent
     */
    snmp_icmp_out_src_quenchs?: number;
    /**
     * Number of ICMP Time Exceeded messages sent
     */
    snmp_icmp_out_time_excds?: number;
    /**
     * Number of ICMP Timestamp Reply messages sent
     */
    snmp_icmp_out_timestamp_reps?: number;
    /**
     * Number of ICMP Timestamp (request) messages sent
     */
    snmp_icmp_out_timestamps?: number;
    /**
     * Default value of the Time-To-Live field of the IP header
     */
    snmp_ip_default_ttl?: number;
    /**
     * Number of datagrams forwarded to their final destination
     */
    snmp_ip_forw_datagrams?: number;
    /**
     * Set when acting as an IP gateway
     */
    snmp_ip_forwarding_enabled?: boolean;
    /**
     * Number of datagrams generated by fragmentation
     */
    snmp_ip_frag_creates?: number;
    /**
     * Number of datagrams discarded because fragmentation failed
     */
    snmp_ip_frag_fails?: number;
    /**
     * Number of datagrams successfully fragmented
     */
    snmp_ip_frag_oks?: number;
    /**
     * Number of input datagrams discarded due to errors in the IP address
     */
    snmp_ip_in_addr_errors?: number;
    /**
     * Number of input datagrams successfully delivered to IP user-protocols
     */
    snmp_ip_in_delivers?: number;
    /**
     * Number of input datagrams otherwise discarded
     */
    snmp_ip_in_discards?: number;
    /**
     * Number of input datagrams discarded due to errors in the IP header
     */
    snmp_ip_in_hdr_errors?: number;
    /**
     * Number of input datagrams received from interfaces
     */
    snmp_ip_in_receives?: number;
    /**
     * Number of input datagrams discarded due unknown or unsupported protocol
     */
    snmp_ip_in_unknown_protos?: number;
    /**
     * Number of output datagrams otherwise discarded
     */
    snmp_ip_out_discards?: number;
    /**
     * Number of output datagrams discarded because no route matched
     */
    snmp_ip_out_no_routes?: number;
    /**
     * Number of datagrams supplied for transmission
     */
    snmp_ip_out_requests?: number;
    /**
     * Number of failures detected by the reassembly algorithm
     */
    snmp_ip_reasm_fails?: number;
    /**
     * Number of datagrams successfully reassembled
     */
    snmp_ip_reasm_oks?: number;
    /**
     * Number of fragments received which needed to be reassembled
     */
    snmp_ip_reasm_reqds?: number;
    /**
     * Number of seconds fragments are held while awaiting reassembly
     */
    snmp_ip_reasm_timeout?: number;
    /**
     * Number of times TCP transitions to SYN-SENT from CLOSED
     */
    snmp_tcp_active_opens?: number;
    /**
     * Number of times TCP transitions to CLOSED from SYN-SENT or SYN-RCVD, plus
     * transitions to LISTEN from SYN-RCVD
     */
    snmp_tcp_attempt_fails?: number;
    /**
     * Number of TCP connections in ESTABLISHED or CLOSE-WAIT
     */
    snmp_tcp_curr_estab?: number;
    /**
     * Number of times TCP transitions to CLOSED from ESTABLISHED or CLOSE-WAIT
     */
    snmp_tcp_estab_resets?: number;
    /**
     * Number of TCP segments received with checksum errors
     */
    snmp_tcp_in_csum_errors?: number;
    /**
     * Number of TCP segments received in error
     */
    snmp_tcp_in_errs?: number;
    /**
     * Number of TCP segments received
     */
    snmp_tcp_in_segs?: number;
    /**
     * Limit on the total number of TCP connections
     */
    snmp_tcp_max_conn?: number;
    /**
     * Number of TCP segments sent with RST flag
     */
    snmp_tcp_out_rsts?: number;
    /**
     * Number of TCP segments sent
     */
    snmp_tcp_out_segs?: number;
    /**
     * Number of times TCP transitions to SYN-RCVD from LISTEN
     */
    snmp_tcp_passive_opens?: number;
    /**
     * Number of TCP segments retransmitted
     */
    snmp_tcp_retrans_segs?: number;
    /**
     * Maximum value permitted by a TCP implementation for the retransmission timeout
     * (milliseconds)
     */
    snmp_tcp_rto_max?: number;
    /**
     * Minimum value permitted by a TCP implementation for the retransmission timeout
     * (milliseconds)
     */
    snmp_tcp_rto_min?: number;
    /**
     * Number of UDP datagrams delivered to UDP applications
     */
    snmp_udp_in_datagrams?: number;
    /**
     * Number of UDP datagrams failed to be delivered for reasons other than lack of
     * application at the destination port
     */
    snmp_udp_in_errors?: number;
    /**
     * Number of UDP datagrams received for which there was not application at the
     * destination port
     */
    snmp_udp_no_ports?: number;
    /**
     * Number of UDP datagrams sent
     */
    snmp_udp_out_datagrams?: number;
    /**
     * Boottime of the system (seconds since the Unix epoch)
     */
    system_boot_time_s?: number;
    thermals?: Array<SnapshotGetResponse.Thermal>;
    tunnels?: Array<SnapshotGetResponse.Tunnel>;
    /**
     * Sum of how much time each core has spent idle
     */
    uptime_idle_ms?: number;
    /**
     * Uptime of the system, including time spent in suspend
     */
    uptime_total_ms?: number;
}
export declare namespace SnapshotGetResponse {
    /**
     * Snapshot DHCP lease
     */
    interface DHCPLease {
        /**
         * Client ID of the device the IP Address was leased to
         */
        client_id: string;
        /**
         * Expiry time of the DHCP lease (seconds since the Unix epoch)
         */
        expiry_time: number;
        /**
         * Hostname of the device the IP Address was leased to
         */
        hostname: string;
        /**
         * Name of the network interface
         */
        interface_name: string;
        /**
         * IP Address that was leased
         */
        ip_address: string;
        /**
         * MAC Address of the device the IP Address was leased to
         */
        mac_address: string;
        /**
         * Connector identifier
         */
        connector_id?: string;
    }
    /**
     * Snapshot Disk
     */
    interface Disk {
        /**
         * I/Os currently in progress
         */
        in_progress: number;
        /**
         * Device major number
         */
        major: number;
        /**
         * Reads merged
         */
        merged: number;
        /**
         * Device minor number
         */
        minor: number;
        /**
         * Device name
         */
        name: string;
        /**
         * Reads completed successfully
         */
        reads: number;
        /**
         * Sectors read successfully
         */
        sectors_read: number;
        /**
         * Sectors written successfully
         */
        sectors_written: number;
        /**
         * Time spent doing I/Os (milliseconds)
         */
        time_in_progress_ms: number;
        /**
         * Time spent reading (milliseconds)
         */
        time_reading_ms: number;
        /**
         * Time spent writing (milliseconds)
         */
        time_writing_ms: number;
        /**
         * Weighted time spent doing I/Os (milliseconds)
         */
        weighted_time_in_progress_ms: number;
        /**
         * Writes completed
         */
        writes: number;
        /**
         * Writes merged
         */
        writes_merged: number;
        /**
         * Connector identifier
         */
        connector_id?: string;
        /**
         * Discards completed successfully
         */
        discards?: number;
        /**
         * Discards merged
         */
        discards_merged?: number;
        /**
         * Flushes completed successfully
         */
        flushes?: number;
        /**
         * Sectors discarded
         */
        sectors_discarded?: number;
        /**
         * Time spent discarding (milliseconds)
         */
        time_discarding_ms?: number;
        /**
         * Time spent flushing (milliseconds)
         */
        time_flushing_ms?: number;
    }
    /**
     * Snapshot Interface
     */
    interface Interface {
        /**
         * Name of the network interface
         */
        name: string;
        /**
         * UP/DOWN state of the network interface
         */
        operstate: string;
        /**
         * Connector identifier
         */
        connector_id?: string;
        ip_addresses?: Array<Interface.IPAddress>;
        /**
         * Speed of the network interface (bits per second)
         */
        speed?: number;
    }
    namespace Interface {
        /**
         * Snapshot Interface Address
         */
        interface IPAddress {
            /**
             * Name of the network interface
             */
            interface_name: string;
            /**
             * IP address of the network interface
             */
            ip_address: string;
            /**
             * Connector identifier
             */
            connector_id?: string;
        }
    }
    /**
     * Snapshot Mount
     */
    interface Mount {
        /**
         * File system on disk (EXT4, NTFS, etc.)
         */
        file_system: string;
        /**
         * Kind of disk (HDD, SSD, etc.)
         */
        kind: string;
        /**
         * Path where disk is mounted
         */
        mount_point: string;
        /**
         * Name of the disk mount
         */
        name: string;
        /**
         * Available disk size (bytes)
         */
        available_bytes?: number;
        /**
         * Connector identifier
         */
        connector_id?: string;
        /**
         * Determines whether the disk is read-only
         */
        is_read_only?: boolean;
        /**
         * Determines whether the disk is removable
         */
        is_removable?: boolean;
        /**
         * Total disk size (bytes)
         */
        total_bytes?: number;
    }
    /**
     * Snapshot Netdev
     */
    interface Netdev {
        /**
         * Name of the network device
         */
        name: string;
        /**
         * Total bytes received
         */
        recv_bytes: number;
        /**
         * Compressed packets received
         */
        recv_compressed: number;
        /**
         * Packets dropped
         */
        recv_drop: number;
        /**
         * Bad packets received
         */
        recv_errs: number;
        /**
         * FIFO overruns
         */
        recv_fifo: number;
        /**
         * Frame alignment errors
         */
        recv_frame: number;
        /**
         * Multicast packets received
         */
        recv_multicast: number;
        /**
         * Total packets received
         */
        recv_packets: number;
        /**
         * Total bytes transmitted
         */
        sent_bytes: number;
        /**
         * Number of packets not sent due to carrier errors
         */
        sent_carrier: number;
        /**
         * Number of collisions
         */
        sent_colls: number;
        /**
         * Number of compressed packets transmitted
         */
        sent_compressed: number;
        /**
         * Number of packets dropped during transmission
         */
        sent_drop: number;
        /**
         * Number of transmission errors
         */
        sent_errs: number;
        /**
         * FIFO overruns
         */
        sent_fifo: number;
        /**
         * Total packets transmitted
         */
        sent_packets: number;
        /**
         * Connector identifier
         */
        connector_id?: string;
    }
    /**
     * Snapshot Thermal
     */
    interface Thermal {
        /**
         * Sensor identifier for the component
         */
        label: string;
        /**
         * Connector identifier
         */
        connector_id?: string;
        /**
         * Critical failure temperature of the component (degrees Celsius)
         */
        critical_celcius?: number;
        /**
         * Current temperature of the component (degrees Celsius)
         */
        current_celcius?: number;
        /**
         * Maximum temperature of the component (degrees Celsius)
         */
        max_celcius?: number;
    }
    /**
     * Snapshot Tunnels
     */
    interface Tunnel {
        /**
         * Name of tunnel health state (unknown, healthy, degraded, down)
         */
        health_state: string;
        /**
         * Numeric value associated with tunnel state (0 = unknown, 1 = healthy, 2 =
         * degraded, 3 = down)
         */
        health_value: number;
        /**
         * The tunnel interface name (i.e. xfrm1, xfrm3.99, etc.)
         */
        interface_name: string;
        /**
         * Tunnel identifier
         */
        tunnel_id: string;
        /**
         * Connector identifier
         */
        connector_id?: string;
    }
}
export interface SnapshotListParams {
    /**
     * Path param: Account identifier
     */
    account_id: string;
    /**
     * Query param:
     */
    from: number;
    /**
     * Query param:
     */
    to: number;
    /**
     * Query param:
     */
    cursor?: string;
    /**
     * Query param:
     */
    limit?: number;
}
export interface SnapshotGetParams {
    /**
     * Account identifier
     */
    account_id: string;
}
export declare namespace Snapshots {
    export { type SnapshotListResponse as SnapshotListResponse, type SnapshotGetResponse as SnapshotGetResponse, type SnapshotListParams as SnapshotListParams, type SnapshotGetParams as SnapshotGetParams, };
    export { Latest as Latest, type LatestListResponse as LatestListResponse, type LatestListParams as LatestListParams, };
}
//# sourceMappingURL=snapshots.d.ts.map