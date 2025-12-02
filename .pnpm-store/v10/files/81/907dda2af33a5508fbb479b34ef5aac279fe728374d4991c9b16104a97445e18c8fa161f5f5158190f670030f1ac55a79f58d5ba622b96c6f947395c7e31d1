/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 */

/*
 * This file was generated from the OpenSearch API Spec. Do NOT edit it
 * manually. If you want to make changes, either update the spec or
 * modify the API generator.
 */

import * as Common from './_common'

export type AllocationDecision = {
  decider: string;
  decision: AllocationExplainDecision;
  explanation: string;
}

export type AllocationExplainDecision = 'ALWAYS' | 'NO' | 'THROTTLE' | 'YES'

export type AllocationStore = {
  allocation_id: string;
  found: boolean;
  in_sync: boolean;
  matching_size_in_bytes: Common.ByteCount;
  matching_sync_id: boolean;
  store_exception: string;
}

export type ClusterInfo = {
  nodes: Record<string, NodeDiskUsage>;
  reserved_sizes: ReservedSize[];
  shard_data_set_sizes?: Record<string, string>;
  shard_paths: Record<string, string>;
  shard_sizes: Record<string, Common.ByteCount | Common.HumanReadableByteCount>;
}

export type CurrentNode = {
  attributes: Record<string, string>;
  id: Common.Id;
  name: Common.Name;
  transport_address: Common.TransportAddress;
  weight_ranking: number;
}

export type Decision = 'allocation_delayed' | 'awaiting_info' | 'no' | 'no_attempt' | 'no_valid_shard_copy' | 'throttled' | 'worse_balance' | 'yes'

export type DiskUsage = {
  free?: Common.HumanReadableByteCount;
  free_bytes: Common.ByteCount;
  free_disk_percent: Common.PercentageNumber;
  path: string;
  total?: Common.HumanReadableByteCount;
  total_bytes: Common.ByteCount;
  used?: Common.HumanReadableByteCount;
  used_bytes: Common.ByteCount;
  used_disk_percent: Common.PercentageNumber;
}

export type NodeAllocationExplanation = {
  deciders: AllocationDecision[];
  node_attributes: Record<string, string>;
  node_decision: Decision;
  node_id: Common.Id;
  node_name: Common.Name;
  store?: AllocationStore;
  transport_address: Common.TransportAddress;
  weight_ranking?: number;
}

export type NodeDiskUsage = {
  least_available: DiskUsage;
  most_available: DiskUsage;
  node_name: Common.Name;
}

export type ReservedSize = {
  node_id: Common.Id;
  path: string;
  shards: string[];
  total: number;
}

export type UnassignedInformation = {
  allocation_status?: string;
  at: Common.DateTime;
  delayed?: boolean;
  details?: string;
  failed_allocation_attempts?: number;
  last_allocation_status?: string;
  reason: UnassignedInformationReason;
}

export type UnassignedInformationReason = 'ALLOCATION_FAILED' | 'CLUSTER_RECOVERED' | 'DANGLING_INDEX_IMPORTED' | 'EXISTING_INDEX_RESTORED' | 'FORCED_EMPTY_PRIMARY' | 'INDEX_CREATED' | 'INDEX_REOPENED' | 'MANUAL_ALLOCATION' | 'NEW_INDEX_RESTORED' | 'NODE_LEFT' | 'PRIMARY_FAILED' | 'REALLOCATED_REPLICA' | 'REINITIALIZED' | 'REPLICA_ADDED' | 'REROUTE_CANCELLED'

