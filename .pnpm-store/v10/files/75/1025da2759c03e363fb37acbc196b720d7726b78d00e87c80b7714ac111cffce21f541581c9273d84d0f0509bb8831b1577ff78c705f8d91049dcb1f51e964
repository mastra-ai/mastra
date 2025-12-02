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

export type DeletedModel = {
  model_id: string;
  result: 'deleted' | 'error';
}

export type GraphMergeStats = {
  current?: number;
  current_docs?: number;
  current_size_in_bytes?: Common.ByteCount;
  total?: number;
  total_docs?: number;
  total_size_in_bytes?: Common.ByteCount;
  total_time_in_millis?: Common.DurationValueUnitMillis;
}

export type GraphRefreshStats = {
  total?: number;
  total_time_in_millis?: Common.DurationValueUnitMillis;
}

export type GraphStats = {
  merge?: GraphMergeStats;
  refresh?: GraphRefreshStats;
}

export type KnnMethod = {
  engine?: string;
  name: string;
  parameters?: Record<string, any>;
  space_type?: string;
}

export type NodeStats = {
  cache_capacity_reached?: boolean;
  eviction_count?: number;
  faiss_initialized?: boolean;
  graph_index_errors?: number;
  graph_index_requests?: number;
  graph_memory_usage?: number;
  graph_memory_usage_percentage?: Common.PercentageNumber;
  graph_query_errors?: number;
  graph_query_requests?: number;
  graph_stats?: GraphStats;
  hit_count?: number;
  indexing_from_model_degraded?: boolean;
  indices_in_cache?: Record<string, any>;
  knn_query_requests?: number;
  knn_query_with_filter_requests?: number;
  load_exception_count?: number;
  load_success_count?: number;
  lucene_initialized?: boolean;
  max_distance_query_requests?: number;
  max_distance_query_with_filter_requests?: number;
  min_score_query_requests?: number;
  min_score_query_with_filter_requests?: number;
  miss_count?: number;
  nmslib_initialized?: boolean;
  script_compilation_errors?: number;
  script_compilations?: number;
  script_query_errors?: number;
  script_query_requests?: number;
  total_load_time?: number;
  training_errors?: number;
  training_memory_usage?: number;
  training_memory_usage_percentage?: Common.PercentageNumber;
  training_requests?: number;
}

export type Stats = {
  _nodes?: Common.NodeStatistics;
  circuit_breaker_triggered?: boolean;
  cluster_name?: Common.Name;
  model_index_status?: Common.HealthStatus | undefined;
  nodes?: Record<string, NodeStats>;
}

export type TrainedModel = {
  compression_level?: string;
  description?: string;
  dimension: number;
  max_training_vector_count?: number;
  method?: KnnMethod;
  mode?: string;
  search_size?: number;
  spaceType?: string;
  training_field: string;
  training_index: string;
}

