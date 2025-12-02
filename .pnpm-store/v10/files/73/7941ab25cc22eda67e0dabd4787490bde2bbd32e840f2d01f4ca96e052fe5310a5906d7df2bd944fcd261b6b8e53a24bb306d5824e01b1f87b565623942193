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

export type FileCountSnapshotStats = {
  file_count?: number;
  size_in_bytes?: Common.ByteCount;
}

export type Repository = {
  settings?: RepositorySettings;
  type?: string;
  uuid?: Common.Uuid;
}

export type RepositorySettings = {
  chunk_size?: string;
  compress?: Common.StringifiedBoolean;
  concurrent_streams?: Common.StringifiedInteger;
  location?: string;
  read_only?: Common.StringifiedBoolean;
}

export type SnapshotIndexStats = {
  shards?: Record<string, SnapshotShardsStatus>;
  shards_stats?: SnapshotShardsStats;
  stats?: SnapshotStats;
}

export type SnapshotInfo = {
  data_streams?: string[];
  duration?: Common.Duration;
  duration_in_millis?: Common.DurationValueUnitMillis;
  end_time?: Common.DateTime;
  end_time_in_millis?: Common.EpochTimeUnitMillis;
  failures?: SnapshotShardFailure[];
  include_global_state?: boolean;
  indices?: Common.IndexName[];
  metadata?: Common.Metadata;
  pinned_timestamp?: Common.EpochTimeUnitMillis;
  reason?: string;
  remote_store_index_shallow_copy?: boolean;
  shards?: Common.ShardStatistics;
  snapshot?: Common.Name;
  start_time?: Common.DateTime;
  start_time_in_millis?: Common.EpochTimeUnitMillis;
  state?: string;
  uuid?: Common.Uuid;
  version?: Common.VersionString;
  version_id?: Common.VersionNumber;
}

export type SnapshotShardFailure = {
  index?: Common.IndexName;
  node_id?: Common.Id;
  reason?: string;
  shard_id?: Common.Id;
  status?: string;
}

export type SnapshotShardsStats = {
  done?: number;
  failed?: number;
  finalizing?: number;
  initializing?: number;
  started?: number;
  total?: number;
}

export type SnapshotShardsStatsStage = 'DONE' | 'FAILURE' | 'FINALIZE' | 'INIT' | 'STARTED'

export type SnapshotShardsStatsSummary = {
  incremental?: SnapshotShardsStatsSummaryItem;
  processed?: SnapshotShardsStatsSummaryItem;
  start_time_in_millis?: Common.EpochTimeUnitMillis;
  time?: Common.Duration;
  time_in_millis?: Common.DurationValueUnitMillis;
  total?: SnapshotShardsStatsSummaryItem;
}

export type SnapshotShardsStatsSummaryItem = {
  file_count?: number;
  size_in_bytes?: Common.ByteCount;
}

export type SnapshotShardsStatus = {
  node?: Common.NodeId;
  reason?: string;
  stage: SnapshotShardsStatsStage;
  stats: SnapshotShardsStatsSummary;
}

export type SnapshotStats = {
  incremental?: FileCountSnapshotStats;
  processed?: FileCountSnapshotStats;
  start_time_in_millis?: Common.EpochTimeUnitMillis;
  time?: Common.Duration;
  time_in_millis?: Common.DurationValueUnitMillis;
  total?: FileCountSnapshotStats;
}

export type SnapshotStatus = {
  include_global_state?: boolean;
  indices?: Record<string, SnapshotIndexStats>;
  repository?: string;
  shards_stats?: SnapshotShardsStats;
  snapshot?: string;
  state?: string;
  stats?: SnapshotStats;
  uuid?: Common.Uuid;
}

