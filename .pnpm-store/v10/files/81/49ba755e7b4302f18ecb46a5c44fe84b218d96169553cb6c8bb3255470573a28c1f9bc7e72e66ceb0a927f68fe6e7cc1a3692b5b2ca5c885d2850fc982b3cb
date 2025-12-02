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

export type AwarenessAttributeStats = {
  active_shards?: number;
  data_nodes?: number;
  initializing_shards?: number;
  relocating_shards?: number;
  unassigned_shards?: number;
  weight?: number;
}

export type HealthResponseBody = {
  active_primary_shards: number;
  active_shards: number;
  active_shards_percent?: Common.PercentageString;
  active_shards_percent_as_number: Common.PercentageNumber;
  awareness_attributes?: Record<string, AwarenessAttributeStats>;
  cluster_name: Common.Name;
  delayed_unassigned_shards: number;
  discovered_cluster_manager?: boolean;
  discovered_master?: boolean;
  indices?: Record<string, IndexHealthStats>;
  initializing_shards: number;
  number_of_data_nodes: number;
  number_of_in_flight_fetch: number;
  number_of_nodes: number;
  number_of_pending_tasks: number;
  relocating_shards: number;
  status: Common.HealthStatus;
  task_max_waiting_in_queue?: Common.Duration;
  task_max_waiting_in_queue_millis: Common.DurationValueUnitMillis;
  timed_out: boolean;
  unassigned_shards: number;
}

export type IndexHealthStats = {
  active_primary_shards: number;
  active_shards: number;
  initializing_shards: number;
  number_of_replicas: number;
  number_of_shards: number;
  relocating_shards: number;
  shards?: Record<string, ShardHealthStats>;
  status: Common.HealthStatus;
  unassigned_shards: number;
}

export type Level = 'awareness_attributes' | 'cluster' | 'indices' | 'shards'

export type ShardHealthStats = {
  active_shards: number;
  initializing_shards: number;
  primary_active: boolean;
  relocating_shards: number;
  status: Common.HealthStatus;
  unassigned_shards: number;
}

