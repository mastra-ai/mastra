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

export type CacheStat = {
  entry_count?: number;
  eviction_count?: number;
  hit_count?: number;
  memory_usage_in_bytes?: number;
  miss_count?: number;
}

export type CacheStats = {
  feature?: CacheStat;
  featureset?: CacheStat;
  model?: CacheStat;
}

export type NodeStats = {
  cache?: CacheStats;
  request_error_count?: number;
  request_total_count?: number;
}

export type Stats = {
  _nodes?: Common.NodeStatistics;
  cluster_name?: Common.Name;
  nodes?: Record<string, NodeStats>;
  status?: string;
  stores?: StoreStats;
}

export type StoreStat = {
  feature_count?: number;
  featureset_count?: number;
  model_count?: number;
  status?: string;
}

export type StoreStats = Record<string, StoreStat>

