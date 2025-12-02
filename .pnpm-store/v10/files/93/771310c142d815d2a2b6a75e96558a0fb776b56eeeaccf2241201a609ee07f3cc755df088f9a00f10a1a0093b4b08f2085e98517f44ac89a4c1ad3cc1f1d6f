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
import * as Indices_Stats from './indices.stats'

export type AdaptiveSelection = {
  avg_queue_size?: number;
  avg_response_time?: Common.Duration;
  avg_response_time_ns?: Common.DurationValueUnitNanos;
  avg_service_time?: Common.Duration;
  avg_service_time_ns?: Common.DurationValueUnitNanos;
  outgoing_searches?: number;
  rank?: string;
}

export type Breaker = {
  estimated_size?: Common.HumanReadableByteCount;
  estimated_size_in_bytes?: Common.ByteCount;
  limit_size?: Common.HumanReadableByteCount;
  limit_size_in_bytes?: Common.ByteCount;
  overhead?: number;
  tripped?: number;
}

export type CacheIndicesStats = CacheStatsBase & Record<string, any>

export type CacheShardStats = CacheStatsBase & Record<string, any>

export type CachesStats = Record<string, CacheStats>

export type CacheStats = CacheStatsBase & {
  indices?: Record<string, CacheIndicesStats>;
  shards?: Record<string, CacheShardStats>;
  store_name?: string;
}

export type CacheStatsBase = {
  evictions?: number;
  hit_count?: number;
  item_count?: number;
  miss_count?: number;
  size?: Common.HumanReadableByteCount;
  size_in_bytes?: Common.ByteCount;
}

export type CgroupCpuAcctStats = {
  control_group?: string;
  usage_nanos?: Common.DurationValueUnitNanos;
}

export type CgroupCpuStat = {
  number_of_elapsed_periods?: number;
  number_of_times_throttled?: number;
  time_throttled_nanos?: Common.DurationValueUnitNanos;
}

export type CgroupCpuStats = {
  cfs_period_micros?: Common.DurationValueUnitMicros;
  cfs_quota_micros?: Common.DurationValueUnitMicros;
  control_group?: string;
  stat?: CgroupCpuStat;
}

export type CgroupMemoryStats = {
  control_group?: string;
  limit_in_bytes?: string;
  usage_in_bytes?: string;
}

export type CgroupStats = {
  cpu?: CgroupCpuStats;
  cpuacct?: CgroupCpuAcctStats;
  memory?: CgroupMemoryStats;
}

export type ClusterStateOverallStats = {
  failed_count?: number;
  total_time_in_millis?: Common.DurationValueUnitMillis;
  update_count?: number;
}

export type ClusterStateQueue = {
  committed?: number;
  pending?: number;
  total?: number;
}

export type ClusterStateStats = {
  overall?: ClusterStateOverallStats;
}

export type DataPathStats = {
  available?: Common.HumanReadableByteCount;
  available_in_bytes?: Common.ByteCount;
  cache_reserved?: Common.HumanReadableByteCount;
  cache_reserved_in_bytes?: Common.ByteCount;
  free?: Common.HumanReadableByteCount;
  free_in_bytes?: Common.ByteCount;
  mount?: string;
  path?: string;
  total?: Common.HumanReadableByteCount;
  total_in_bytes?: Common.ByteCount;
  type?: string;
}

export type Discovery = {
  cluster_state_queue?: ClusterStateQueue;
  cluster_state_stats?: ClusterStateStats;
  published_cluster_states?: PublishedClusterStates;
}

export type ExtendedMemoryStats = MemoryStatsBase & {
  free_percent?: Common.PercentageNumber;
  used_percent?: Common.PercentageNumber;
}

export type FileSystem = {
  data?: DataPathStats[];
  io_stats?: IoStats;
  timestamp?: Common.EpochTimeUnitMillis;
  total?: FileSystemTotal;
}

export type FileSystemTotal = {
  available?: Common.HumanReadableByteCount;
  available_in_bytes?: Common.ByteCount;
  cache_reserved?: Common.HumanReadableByteCount;
  cache_reserved_in_bytes?: Common.ByteCount;
  free?: Common.HumanReadableByteCount;
  free_in_bytes?: Common.ByteCount;
  total?: Common.HumanReadableByteCount;
  total_in_bytes?: Common.ByteCount;
}

export type GarbageCollector = {
  collectors?: Record<string, GarbageCollectorTotal>;
}

export type GarbageCollectorTotal = {
  collection_count?: number;
  collection_time?: Common.Duration;
  collection_time_in_millis?: Common.DurationValueUnitMillis;
}

export type Http = {
  current_open?: number;
  total_opened?: number;
}

export type IndexingPressure = {
  memory?: IndexingPressureMemory;
}

export type IndexingPressureMemory = {
  current?: PressureMemory;
  limit?: Common.HumanReadableByteCount;
  limit_in_bytes?: Common.ByteCount;
  total?: PressureMemory;
}

export type IndexMetric = '_all' | 'completion' | 'docs' | 'fielddata' | 'flush' | 'get' | 'indexing' | 'merge' | 'query_cache' | 'recovery' | 'refresh' | 'request_cache' | 'search' | 'segments' | 'store' | 'suggest' | 'translog' | 'warmer'

export type Ingest = {
  pipelines?: Record<string, IngestTotal>;
  total?: IngestTotal;
}

export type IngestTotal = {
  count?: number;
  current?: number;
  failed?: number;
  processors?: Record<string, KeyedProcessor>[];
  time?: Common.Duration;
  time_in_millis?: Common.DurationValueUnitMillis;
}

export type IoStatDevice = {
  device_name?: string;
  io_time_in_millis?: Common.DurationValueUnitMillis;
  operations?: number;
  queue_size?: number;
  read_kilobytes?: number;
  read_operations?: number;
  read_time?: number;
  write_kilobytes?: number;
  write_operations?: number;
  write_time?: number;
}

export type IoStats = {
  devices?: IoStatDevice[];
  total?: IoStatDevice;
}

export type Jvm = {
  buffer_pools?: Record<string, NodeBufferPool>;
  classes?: JvmClasses;
  gc?: GarbageCollector;
  mem?: JvmMemoryStats;
  threads?: JvmThreads;
  timestamp?: Common.EpochTimeUnitMillis;
  uptime?: Common.Duration;
  uptime_in_millis?: Common.DurationValueUnitMillis;
}

export type JvmClasses = {
  current_loaded_count?: number;
  total_loaded_count?: number;
  total_unloaded_count?: number;
}

export type JvmMemoryStats = {
  heap_committed?: Common.HumanReadableByteCount;
  heap_committed_in_bytes?: Common.ByteCount;
  heap_max?: Common.HumanReadableByteCount;
  heap_max_in_bytes?: Common.ByteCount;
  heap_used?: Common.HumanReadableByteCount;
  heap_used_in_bytes?: Common.ByteCount;
  heap_used_percent?: Common.PercentageNumber;
  non_heap_committed?: Common.HumanReadableByteCount;
  non_heap_committed_in_bytes?: Common.ByteCount;
  non_heap_used?: Common.HumanReadableByteCount;
  non_heap_used_in_bytes?: Common.ByteCount;
  pools?: Record<string, Pool>;
}

export type JvmThreads = {
  count?: number;
  peak_count?: number;
}

export type KeyedProcessor = {
  stats?: Processor;
  type?: string;
}

export type LastGcStats = {
  max?: Common.HumanReadableByteCount;
  max_in_bytes?: Common.ByteCount;
  usage_percent?: Common.PercentageNumber;
  used?: Common.HumanReadableByteCount;
  used_in_bytes?: Common.ByteCount;
}

export type MemoryStats = MemoryStatsBase & Record<string, any>

export type MemoryStatsBase = {
  free?: Common.HumanReadableByteCount;
  free_in_bytes?: Common.ByteCount;
  total?: Common.HumanReadableByteCount;
  total_in_bytes?: Common.ByteCount;
  used?: Common.HumanReadableByteCount;
  used_in_bytes?: Common.ByteCount;
}

export type Metric = '_all' | 'adaptive_selection' | 'admission_control' | 'breaker' | 'caches' | 'cluster_manager_throttling' | 'discovery' | 'file_cache' | 'fs' | 'http' | 'indexing_pressure' | 'indices' | 'ingest' | 'jvm' | 'os' | 'process' | 'repositories' | 'resource_usage_stats' | 'script' | 'script_cache' | 'search_backpressure' | 'search_pipeline' | 'segment_replication_backpressure' | 'shard_indexing_pressure' | 'task_cancellation' | 'thread_pool' | 'transport' | 'weighted_routing'

export type NodeBufferPool = {
  count?: number;
  total_capacity?: Common.HumanReadableByteCount;
  total_capacity_in_bytes?: Common.ByteCount;
  used?: Common.HumanReadableByteCount;
  used_in_bytes?: Common.ByteCount;
}

export type NodeIndexShardStats = Indices_Stats.IndexShardStatsBase & Record<string, any>

export type NodeIndicesStats = Indices_Stats.IndexStatsBase & {
  indices?: Record<string, Indices_Stats.IndexStats>;
  shards?: Record<string, Record<string, NodeIndexShardStats>[]>;
}

export type OperatingSystem = {
  cgroup?: CgroupStats;
  cpu?: OperatingSystemCpuStats;
  mem?: ExtendedMemoryStats;
  swap?: MemoryStats;
  timestamp?: Common.EpochTimeUnitMillis;
}

export type OperatingSystemCpuStats = {
  load_average?: Record<string, number>;
  percent?: Common.PercentageNumber;
}

export type Pool = {
  last_gc_stats?: LastGcStats;
  max?: Common.HumanReadableByteCount;
  max_in_bytes?: Common.ByteCount;
  peak_max?: Common.HumanReadableByteCount;
  peak_max_in_bytes?: Common.ByteCount;
  peak_used?: Common.HumanReadableByteCount;
  peak_used_in_bytes?: Common.ByteCount;
  used?: Common.HumanReadableByteCount;
  used_in_bytes?: Common.ByteCount;
}

export type PressureMemory = {
  all?: Common.HumanReadableByteCount;
  all_in_bytes?: Common.ByteCount;
  combined_coordinating_and_primary?: Common.HumanReadableByteCount;
  combined_coordinating_and_primary_in_bytes?: Common.ByteCount;
  coordinating?: Common.HumanReadableByteCount;
  coordinating_in_bytes?: Common.ByteCount;
  coordinating_rejections?: number;
  primary?: Common.HumanReadableByteCount;
  primary_in_bytes?: Common.ByteCount;
  primary_rejections?: number;
  replica?: Common.HumanReadableByteCount;
  replica_in_bytes?: Common.ByteCount;
  replica_rejections?: number;
}

export type Process = {
  cpu?: ProcessCpuStats;
  max_file_descriptors?: number;
  mem?: ProcessMemoryStats;
  open_file_descriptors?: number;
  timestamp?: Common.EpochTimeUnitMillis;
}

export type ProcessCpuStats = {
  percent: Common.PercentageNumber;
  total?: Common.Duration;
  total_in_millis: Common.DurationValueUnitMillis;
}

export type ProcessMemoryStats = {
  total_virtual?: Common.HumanReadableByteCount;
  total_virtual_in_bytes?: Common.ByteCount;
}

export type Processor = {
  count?: number;
  current?: number;
  failed?: number;
  time?: Common.Duration;
  time_in_millis?: Common.DurationValueUnitMillis;
}

export type PublishedClusterStates = {
  compatible_diffs?: number;
  full_states?: number;
  incompatible_diffs?: number;
}

export type RemoteStoreStats = {
  last_successful_fetch_of_pinned_timestamps?: Common.EpochTimeUnitSeconds;
}

export type ScriptCacheStats = {
  contexts?: ScriptContextStats[];
  sum: ScriptStats;
}

export type ScriptContextStats = ScriptStatsBase & {
  context: string;
}

export type ScriptStats = ScriptStatsBase & Record<string, any>

export type ScriptStatsBase = {
  cache_evictions: number;
  compilation_limit_triggered: number;
  compilations: number;
}

export type ShardAdmissionControlStats = {
  global_cpu_usage?: UsageStats;
  global_io_usage?: UsageStats;
}

export type ShardClusterManagerThrottlingStats = {
  stats?: ShardClusterManagerThrottlingStatsDetail;
}

export type ShardClusterManagerThrottlingStatsDetail = {
  throttled_tasks_per_task_type: Record<string, number>;
  total_throttled_tasks: number;
}

export type ShardIndexingPressurePerShardIndexingStats = {
  coordinating_count: number;
  coordinating_time_in_millis: Common.DurationValueUnitMillis;
  primary_count: number;
  primary_time_in_millis: Common.DurationValueUnitMillis;
  replica_count: number;
  replica_time_in_millis: Common.DurationValueUnitMillis;
}

export type ShardIndexingPressurePerShardLastSuccessfulTimestamp = {
  coordinating_last_successful_request_timestamp_in_millis: Common.EpochTimeUnitMillis;
  primary_last_successful_request_timestamp_in_millis: Common.EpochTimeUnitMillis;
  replica_last_successful_request_timestamp_in_millis: Common.EpochTimeUnitMillis;
}

export type ShardIndexingPressurePerShardMemoryAllocationCurrentStats = {
  current_coordinating_and_primary_bytes: Common.ByteCount;
  current_replica_bytes: Common.ByteCount;
}

export type ShardIndexingPressurePerShardMemoryAllocationLimitStats = {
  current_coordinating_and_primary_limits_in_bytes: Common.ByteCount;
  current_replica_limits_in_bytes: Common.ByteCount;
}

export type ShardIndexingPressurePerShardMemoryAllocationStats = {
  current: ShardIndexingPressurePerShardMemoryAllocationCurrentStats;
  limit: ShardIndexingPressurePerShardMemoryAllocationLimitStats;
}

export type ShardIndexingPressurePerShardMemoryStats = {
  current: ShardIndexingPressurePerShardMemoryStatsDetails;
  total: ShardIndexingPressurePerShardMemoryStatsDetails;
}

export type ShardIndexingPressurePerShardMemoryStatsDetails = {
  coordinating?: Common.HumanReadableByteCount;
  coordinating_in_bytes: Common.ByteCount;
  primary?: Common.HumanReadableByteCount;
  primary_in_bytes: Common.ByteCount;
  replica?: Common.HumanReadableByteCount;
  replica_in_bytes: Common.ByteCount;
}

export type ShardIndexingPressurePerShardRejectionCoordinatingStats = {
  breakup?: ShardIndexingPressureRejectionsBreakupStats;
  breakup_shadow_mode?: ShardIndexingPressureRejectionsBreakupStats;
  coordinating_rejections: number;
}

export type ShardIndexingPressurePerShardRejectionPrimaryStats = {
  breakup?: ShardIndexingPressureRejectionsBreakupStats;
  breakup_shadow_mode?: ShardIndexingPressureRejectionsBreakupStats;
  primary_rejections: number;
}

export type ShardIndexingPressurePerShardRejectionReplicaStats = {
  breakup?: ShardIndexingPressureRejectionsBreakupStats;
  breakup_shadow_mode?: ShardIndexingPressureRejectionsBreakupStats;
  replica_rejections: number;
}

export type ShardIndexingPressurePerShardRejectionStats = {
  coordinating: ShardIndexingPressurePerShardRejectionCoordinatingStats;
  primary: ShardIndexingPressurePerShardRejectionPrimaryStats;
  replica: ShardIndexingPressurePerShardRejectionReplicaStats;
}

export type ShardIndexingPressurePerShardStats = {
  indexing: ShardIndexingPressurePerShardIndexingStats;
  last_successful_timestamp: ShardIndexingPressurePerShardLastSuccessfulTimestamp;
  memory: ShardIndexingPressurePerShardMemoryStats;
  memory_allocation: ShardIndexingPressurePerShardMemoryAllocationStats;
  rejection: ShardIndexingPressurePerShardRejectionStats;
}

export type ShardIndexingPressureRejectionsBreakupStats = {
  no_successful_request_limits?: number;
  node_limits?: number;
  throughput_degradation_limits?: number;
}

export type ShardIndexingPressureStats = {
  enabled?: boolean;
  enforced?: boolean;
  stats?: Record<string, ShardIndexingPressurePerShardStats>;
  total_rejections_breakup?: ShardIndexingPressureRejectionsBreakupStats;
  total_rejections_breakup_shadow_mode?: ShardIndexingPressureRejectionsBreakupStats;
}

export type ShardRepositoriesStats = any[]

export type ShardResourceUsageStats = Record<string, ShardResourceUsageStatsDetail>

export type ShardResourceUsageStatsDetail = {
  cpu_utilization_percent?: Common.PercentageString;
  io_usage_stats?: ShardResourceUsageStatsIoUsageStats;
  memory_utilization_percent?: Common.PercentageString;
  timestamp?: Common.EpochTimeUnitMillis;
}

export type ShardResourceUsageStatsIoUsageStats = {
  max_io_utilization_percent?: Common.PercentageString;
}

export type ShardSearchBackpressureMode = 'disabled' | 'enforced' | 'monitor_only'

export type ShardSearchBackpressureStats = {
  mode?: ShardSearchBackpressureMode;
  search_shard_task?: ShardSearchBackpressureTaskStats;
  search_task?: ShardSearchBackpressureTaskStats;
}

export type ShardSearchBackpressureTaskCancellationStats = {
  cancellation_count?: number;
  cancellation_limit_reached_count?: number;
  cancelled_task_percentage?: Common.PercentageNumber;
  current_cancellation_eligible_tasks_count?: number;
}

export type ShardSearchBackpressureTaskResourceTrackerCpuUsageTrackerStats = {
  cancellation_count?: number;
  current_avg?: Common.Duration;
  current_avg_millis?: Common.DurationValueUnitMillis;
  current_max?: Common.Duration;
  current_max_millis?: Common.DurationValueUnitMillis;
}

export type ShardSearchBackpressureTaskResourceTrackerElapsedTimeTrackerStats = {
  cancellation_count?: number;
  current_avg?: Common.Duration;
  current_avg_millis?: Common.DurationValueUnitMillis;
  current_max?: Common.Duration;
  current_max_millis?: Common.DurationValueUnitMillis;
}

export type ShardSearchBackpressureTaskResourceTrackerHeapUsageTrackerStats = {
  cancellation_count?: number;
  current_avg?: Common.HumanReadableByteCount;
  current_avg_bytes?: Common.ByteCount;
  current_max?: Common.HumanReadableByteCount;
  current_max_bytes?: Common.ByteCount;
  rolling_avg?: Common.HumanReadableByteCount;
  rolling_avg_bytes?: Common.ByteCount;
}

export type ShardSearchBackpressureTaskResourceTrackerStats = {
  cpu_usage_tracker?: ShardSearchBackpressureTaskResourceTrackerCpuUsageTrackerStats;
  elapsed_time_tracker?: ShardSearchBackpressureTaskResourceTrackerElapsedTimeTrackerStats;
  heap_usage_tracker?: ShardSearchBackpressureTaskResourceTrackerHeapUsageTrackerStats;
}

export type ShardSearchBackpressureTaskStats = {
  cancellation_stats?: ShardSearchBackpressureTaskCancellationStats;
  completion_count?: number;
  resource_tracker_stats?: ShardSearchBackpressureTaskResourceTrackerStats;
}

export type ShardSearchPipelineOperationStats = {
  count?: number;
  current?: number;
  failed?: number;
  time?: Common.Duration;
  time_in_millis?: Common.DurationValueUnitMillis;
}

export type ShardSearchPipelinePerPipelineProcessorStats = {
  stats?: ShardSearchPipelineOperationStats;
  type?: string;
}

export type ShardSearchPipelinePerPipelineStats = {
  request?: ShardSearchPipelineOperationStats;
  request_processors?: ShardSearchPipelinePerPipelineProcessorStats[];
  response?: ShardSearchPipelineOperationStats;
  response_processors?: Record<string, ShardSearchPipelinePerPipelineProcessorStats>[];
}

export type ShardSearchPipelineStats = {
  pipelines?: Record<string, ShardSearchPipelinePerPipelineStats>;
  total_request?: ShardSearchPipelineOperationStats;
  total_response?: ShardSearchPipelineOperationStats;
}

export type ShardSegmentReplicationBackpressureStats = {
  total_rejected_requests?: number;
}

export type ShardTaskCancellationStats = {
  search_shard_task?: ShardTaskCancellationStatsDetail;
}

export type ShardTaskCancellationStatsDetail = {
  current_count_post_cancel?: number;
  total_count_post_cancel?: number;
}

export type ShardWeightedRoutingStats = {
  stats?: ShardWeightedRoutingStatsDetail;
}

export type ShardWeightedRoutingStatsDetail = {
  fail_open_count?: number;
}

export type Stats = {
  adaptive_selection?: Record<string, AdaptiveSelection>;
  admission_control?: ShardAdmissionControlStats;
  attributes?: Record<string, string>;
  breakers?: Record<string, Breaker>;
  caches?: CachesStats;
  cluster_manager_throttling?: ShardClusterManagerThrottlingStats;
  discovery?: Discovery;
  fs?: FileSystem;
  host?: Common.Host;
  http?: Http;
  indexing_pressure?: IndexingPressure;
  indices?: NodeIndicesStats;
  ingest?: Ingest;
  ip?: Common.Ip | Common.Ip[];
  jvm?: Jvm;
  name?: Common.Name;
  os?: OperatingSystem;
  process?: Process;
  remote_store?: RemoteStoreStats;
  repositories?: ShardRepositoriesStats;
  resource_usage_stats?: ShardResourceUsageStats;
  roles?: Common.NodeRoles;
  script?: ScriptStats;
  script_cache?: ScriptCacheStats;
  search_backpressure?: ShardSearchBackpressureStats;
  search_pipeline?: ShardSearchPipelineStats;
  segment_replication_backpressure?: ShardSegmentReplicationBackpressureStats;
  shard_indexing_pressure?: ShardIndexingPressureStats;
  task_cancellation?: ShardTaskCancellationStats;
  thread_pool?: Record<string, ThreadCount>;
  timestamp?: Common.EpochTimeUnitMillis;
  transport?: Transport;
  transport_address?: Common.TransportAddress;
  weighted_routing?: ShardWeightedRoutingStats;
}

export type ThreadCount = {
  active?: number;
  completed?: number;
  largest?: number;
  queue?: number;
  rejected?: number;
  threads?: number;
  total_wait_time?: Common.Duration;
  total_wait_time_in_nanos?: Common.DurationValueUnitNanos;
}

export type Transport = {
  rx_count?: number;
  rx_size?: Common.HumanReadableByteCount;
  rx_size_in_bytes?: Common.ByteCount;
  server_open?: number;
  total_outbound_connections?: number;
  tx_count?: number;
  tx_size?: Common.HumanReadableByteCount;
  tx_size_in_bytes?: Common.ByteCount;
}

export type TransportUsageStats = {
  rejection_count?: Record<string, number>;
}

export type UsageStats = {
  transport?: TransportUsageStats;
}

