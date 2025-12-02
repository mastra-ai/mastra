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

export type AllIndicesStats = {
  primaries: IndexStats;
  total: IndexStats;
}

export type IndexShardStats = IndexShardStatsBase & Record<string, any>

export type IndexShardStatsBase = IndexStatsBase & {
  commit?: ShardCommit;
  retention_leases?: ShardRetentionLeases;
  routing?: ShardRouting;
  seq_no?: ShardSequenceNumber;
  shard_path?: ShardPath;
}

export type IndexStats = IndexStatsBase & Record<string, any>

export type IndexStatsBase = {
  completion?: Common.CompletionStats;
  docs?: Common.DocStats;
  fielddata?: Common.FielddataStats;
  flush?: Common.FlushStats;
  get?: Common.GetStats;
  indexing?: Common.IndexingStats;
  merges?: Common.MergesStats;
  query_cache?: Common.QueryCacheStats;
  recovery?: Common.RecoveryStats;
  refresh?: Common.RefreshStats;
  request_cache?: Common.RequestCacheStats;
  search?: Common.SearchStats;
  segments?: Common.SegmentsStats;
  store?: Common.StoreStats;
  translog?: Common.TranslogStats;
  warmer?: Common.WarmerStats;
}

export type IndicesStats = {
  primaries: IndexStats;
  shards?: Record<string, IndexShardStats[]>;
  total: IndexStats;
  uuid: Common.Uuid;
}

export type Metric = '_all' | 'completion' | 'docs' | 'fielddata' | 'flush' | 'get' | 'indexing' | 'merge' | 'query_cache' | 'recovery' | 'refresh' | 'request_cache' | 'search' | 'segments' | 'store' | 'suggest' | 'translog' | 'warmer'

export type ShardCommit = {
  generation: number;
  id: Common.Id;
  num_docs: number;
  user_data: Record<string, string>;
}

export type ShardFileSizeInfo = {
  average_size_in_bytes?: Common.ByteCount;
  count?: number;
  description: string;
  max_size_in_bytes?: Common.ByteCount;
  min_size_in_bytes?: Common.ByteCount;
  size?: Common.HumanReadableByteCount;
  size_in_bytes: Common.ByteCount;
}

export type ShardLease = {
  id: Common.Id;
  retaining_seq_no: Common.SequenceNumber;
  source: string;
  timestamp: number;
}

export type ShardPath = {
  data_path: string;
  is_custom_data_path: boolean;
  state_path: string;
}

export type ShardRetentionLeases = {
  leases: ShardLease[];
  primary_term: number;
  version: Common.VersionNumber;
}

export type ShardRouting = {
  node: string;
  primary: boolean;
  relocating_node?: undefined | string;
  state: ShardRoutingState;
}

export type ShardRoutingState = 'INITIALIZING' | 'RELOCATING' | 'STARTED' | 'UNASSIGNED'

export type ShardSequenceNumber = {
  global_checkpoint: number;
  local_checkpoint: number;
  max_seq_no: Common.SequenceNumber;
}

