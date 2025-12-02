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

export type CharFilterTypes = {
  analyzer_types: FieldTypes[];
  built_in_analyzers: FieldTypes[];
  built_in_char_filters: FieldTypes[];
  built_in_filters: FieldTypes[];
  built_in_tokenizers: FieldTypes[];
  char_filter_types: FieldTypes[];
  filter_types: FieldTypes[];
  tokenizer_types: FieldTypes[];
}

export type ClusterFileSystem = {
  available?: Common.HumanReadableByteCount;
  available_in_bytes: Common.ByteCount;
  cache_reserved?: Common.HumanReadableByteCount;
  cache_reserved_in_bytes?: Common.ByteCount;
  free?: Common.HumanReadableByteCount;
  free_in_bytes: Common.ByteCount;
  total?: Common.HumanReadableByteCount;
  total_in_bytes: Common.ByteCount;
}

export type ClusterIndices = {
  analysis?: CharFilterTypes;
  completion?: Common.CompletionStats;
  count?: number;
  docs?: Common.DocStats;
  fielddata?: Common.FielddataStats;
  mappings?: FieldTypesMappings;
  query_cache?: Common.QueryCacheStats;
  segments?: Common.SegmentsStats;
  shards?: ClusterIndicesShards;
  store?: Common.StoreStats;
  versions?: IndicesVersions[];
}

export type ClusterIndicesShards = {
  index?: ClusterIndicesShardsIndex;
  primaries?: number;
  replication?: number;
  total?: number;
}

export type ClusterIndicesShardsIndex = {
  primaries: ClusterShardMetrics;
  replication: ClusterShardMetrics;
  shards: ClusterShardMetrics;
}

export type ClusterIngest = {
  number_of_pipelines: number;
  processor_stats: Record<string, ClusterProcessor>;
}

export type ClusterJvm = {
  max_uptime?: Common.Duration;
  max_uptime_in_millis: Common.DurationValueUnitMillis;
  mem: ClusterJvmMemory;
  threads: number;
  versions: ClusterJvmVersion[];
}

export type ClusterJvmMemory = {
  heap_max?: Common.HumanReadableByteCount;
  heap_max_in_bytes: Common.ByteCount;
  heap_used?: Common.HumanReadableByteCount;
  heap_used_in_bytes: Common.ByteCount;
}

export type ClusterJvmVersion = {
  bundled_jdk: boolean;
  count: number;
  using_bundled_jdk: boolean;
  version: Common.VersionString;
  vm_name: string;
  vm_vendor: string;
  vm_version: Common.VersionString;
}

export type ClusterNetworkTypes = {
  http_types: Record<string, number>;
  transport_types: Record<string, number>;
}

export type ClusterNodeCount = {
  cluster_manager?: number;
  coordinating_only: number;
  data: number;
  data_cold?: number;
  data_content?: number;
  data_frozen?: number;
  data_hot?: number;
  data_warm?: number;
  ingest: number;
  master: number;
  ml?: number;
  remote_cluster_client: number;
  search?: number;
  total: number;
  transform?: number;
  voting_only?: number;
  warm?: number;
}

export type ClusterNodes = {
  count?: ClusterNodeCount;
  discovery_types?: Record<string, number>;
  fs?: ClusterFileSystem;
  indexing_pressure?: IndexingPressure;
  ingest?: ClusterIngest;
  jvm?: ClusterJvm;
  network_types?: ClusterNetworkTypes;
  os?: ClusterOperatingSystem;
  packaging_types?: NodePackagingType[];
  plugins?: Common.PluginStats[];
  process?: ClusterProcess;
  versions?: Common.VersionString[];
}

export type ClusterOperatingSystem = {
  allocated_processors: number;
  architectures?: ClusterOperatingSystemArchitecture[];
  available_processors: number;
  mem: OperatingSystemMemoryInfo;
  names: ClusterOperatingSystemName[];
  pretty_names: ClusterOperatingSystemPrettyName[];
}

export type ClusterOperatingSystemArchitecture = {
  arch: string;
  count: number;
}

export type ClusterOperatingSystemName = {
  count: number;
  name: Common.Name;
}

export type ClusterOperatingSystemPrettyName = {
  count: number;
  pretty_name: Common.Name;
}

export type ClusterProcess = {
  cpu: ClusterProcessCpu;
  open_file_descriptors: ClusterProcessOpenFileDescriptors;
}

export type ClusterProcessCpu = {
  percent: Common.PercentageNumber;
}

export type ClusterProcessOpenFileDescriptors = {
  avg: number;
  max: number;
  min: number;
}

export type ClusterProcessor = {
  count: number;
  current: number;
  failed: number;
  time?: Common.Duration;
  time_in_millis: Common.DurationValueUnitMillis;
}

export type ClusterShardMetrics = {
  avg: number;
  max: number;
  min: number;
}

export type FieldTypes = {
  count: number;
  index_count: number;
  name: Common.Name;
}

export type FieldTypesMappings = {
  field_types: FieldTypes[];
}

export type IndexingPressure = {
  memory: IndexingPressureMemory;
}

export type IndexingPressureMemory = {
  current: IndexingPressureMemorySummary;
  limit_in_bytes: Common.ByteCount;
  total: IndexingPressureMemorySummary;
}

export type IndexingPressureMemorySummary = {
  all_in_bytes: Common.ByteCount;
  combined_coordinating_and_primary_in_bytes: Common.ByteCount;
  coordinating_in_bytes: Common.ByteCount;
  coordinating_rejections?: number;
  primary_in_bytes: Common.ByteCount;
  primary_rejections?: number;
  replica_in_bytes: Common.ByteCount;
  replica_rejections?: number;
}

export type IndexMetric = '_all' | 'analysis' | 'completion' | 'docs' | 'fielddata' | 'mappings' | 'query_cache' | 'segments' | 'shards' | 'store'

export type IndicesVersions = {
  index_count: number;
  primary_shard_count: number;
  total_primary_bytes: Common.ByteCount;
  version: Common.VersionString;
}

export type Metric = '_all' | 'discovery_type' | 'fs' | 'indices' | 'ingest' | 'jvm' | 'network_types' | 'os' | 'packaging_types' | 'plugins' | 'process'

export type NodePackagingType = {
  count: number;
  flavor?: string;
  type: string;
}

export type OperatingSystemMemoryInfo = {
  adjusted_total_in_bytes?: Common.ByteCount;
  free?: Common.HumanReadableByteCount;
  free_in_bytes: Common.ByteCount;
  free_percent: Common.PercentageNumber;
  total?: Common.HumanReadableByteCount;
  total_in_bytes: Common.ByteCount;
  used?: Common.HumanReadableByteCount;
  used_in_bytes: Common.ByteCount;
  used_percent: Common.PercentageNumber;
}

