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

export type AutoFollowStats = {
  failed_indices?: string[];
  last_execution_time?: number;
  name?: string;
  num_failed_leader_calls?: number;
  num_failed_start_replication?: number;
  num_success_start_replication?: number;
  pattern?: string;
}

export type AutoFollowStatus = {
  autofollow_stats?: AutoFollowStats[];
  failed_indices?: string[];
  num_failed_leader_calls?: number;
  num_failed_start_replication?: number;
  num_success_start_replication?: number;
}

export type CreateReplicationRule = {
  leader_alias?: Common.IndexAlias;
  name?: string;
  pattern?: string;
  use_roles?: UseRoles;
}

export type DeleteReplicationRule = {
  leader_alias?: Common.IndexAlias;
  name?: string;
}

export type FollowerStatus = {
  failed_read_requests?: number;
  failed_write_requests?: number;
  follower_checkpoint?: number;
  index_stats?: Record<string, IndexFollowerStatus>;
  leader_checkpoint?: number;
  num_bootstrapping_indices?: number;
  num_failed_indices?: number;
  num_index_tasks?: number;
  num_paused_indices?: number;
  num_shard_tasks?: number;
  num_syncing_indices?: number;
  operations_read?: number;
  operations_written?: number;
  throttled_read_requests?: number;
  throttled_write_requests?: number;
  total_write_time_millis?: Common.StringifiedEpochTimeUnitMillis;
}

export type IndexFollowerStatus = {
  failed_read_requests?: number;
  failed_write_requests?: number;
  follower_checkpoint?: number;
  leader_checkpoint?: number;
  operations_read?: number;
  operations_written?: number;
  throttled_read_requests?: number;
  throttled_write_requests?: number;
  total_write_time_millis?: Common.StringifiedEpochTimeUnitMillis;
}

export type IndexSchema = {
  number_of_replicas?: number;
  number_of_shards?: number;
}

export type IndexStatus = {
  bytes_read?: Common.ByteCount;
  operations_read?: number;
  operations_read_lucene?: number;
  operations_read_translog?: number;
  total_read_time_lucene_millis?: Common.StringifiedEpochTimeUnitMillis;
  total_read_time_translog_millis?: Common.StringifiedEpochTimeUnitMillis;
  translog_size_bytes?: Common.ByteCount;
}

export type LeaderStatus = {
  bytes_read?: Common.ByteCount;
  index_stats?: Record<string, IndexStatus>;
  num_replicated_indices?: number;
  operations_read?: number;
  operations_read_lucene?: number;
  operations_read_translog?: number;
  total_read_time_lucene_millis?: Common.StringifiedEpochTimeUnitMillis;
  total_read_time_translog_millis?: Common.StringifiedEpochTimeUnitMillis;
  translog_size_bytes?: Common.ByteCount;
}

export type Replication = {
  leader_alias?: Common.IndexAlias;
  leader_index?: Common.IndexName;
  use_roles?: UseRoles;
}

export type SettingsBody = {
  index?: IndexSchema;
}

export type Status = {
  follower_index?: Common.IndexName;
  leader_alias?: Common.IndexAlias;
  leader_index?: Common.IndexName;
  reason?: string;
  status?: 'BOOTSTRAPPING' | 'PAUSED' | 'REPLICATION NOT IN PROGRESS' | 'RUNNING' | 'SYNCING';
  syncing_details?: SyncingDetails;
}

export type SyncingDetails = {
  follower_checkpoint?: number;
  leader_checkpoint?: number;
  seq_no?: Common.SequenceNumber;
}

export type UpdateSettings = {
  settings?: SettingsBody & {
  'index.number_of_replicas'?: number;
  'index.number_of_shards'?: number;
};
}

export type UseRoles = {
  follower_cluster_role?: string;
  leader_cluster_role?: string;
}

