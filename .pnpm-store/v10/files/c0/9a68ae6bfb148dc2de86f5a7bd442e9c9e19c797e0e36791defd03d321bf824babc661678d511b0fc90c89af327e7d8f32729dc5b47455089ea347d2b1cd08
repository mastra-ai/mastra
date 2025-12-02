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
import * as Common_QueryDsl from './_common.query_dsl'
import * as Core_Search from './_core.search'

export type GroupingType = 'NONE' | 'SIMILARITY' | 'none' | 'similarity'

export type Measurement = {
  aggregationType?: string;
  count?: number;
  number?: number;
}

export type Measurements = {
  cpu?: Measurement;
  latency?: Measurement;
  memory?: Measurement;
}

export type Source = {
  _source?: Core_Search.SourceConfig;
  aggregations?: Record<string, any>;
  collapse?: Core_Search.FieldCollapse;
  docvalue_fields?: Common_QueryDsl.FieldAndFormat[];
  explain?: boolean;
  ext?: Record<string, Record<string, any>>;
  fields?: Common_QueryDsl.FieldAndFormat[];
  from?: number;
  highlight?: Core_Search.Highlight;
  indices_boost?: Record<string, number>[];
  min_score?: number;
  pit?: Core_Search.PointInTimeReference;
  post_filter?: Common_QueryDsl.QueryContainer;
  profile?: boolean;
  query?: Common_QueryDsl.QueryContainer;
  script_fields?: Record<string, Common.ScriptField>;
  search_after?: Common.SortResults;
  seq_no_primary_term?: boolean;
  size?: number;
  slice?: Common.SlicedScroll;
  sort?: Common.Sort;
  stats?: string[];
  stored_fields?: Common.Fields;
  suggest?: Core_Search.Suggester;
  terminate_after?: number;
  timeout?: string;
  track_scores?: boolean;
  track_total_hits?: Core_Search.TrackHits;
  version?: boolean;
}

export type TaskResourceUsage = {
  cpu_time_in_nanos?: number;
  memory_in_bytes?: number;
}

export type TaskResourceUsages = {
  action?: string;
  nodeId?: string;
  parentTaskId?: number;
  taskId?: number;
  taskResourceUsage?: TaskResourceUsage;
}

export type TopQueriesResponse = {
  top_queries: TopQuery[];
}

export type TopQuery = {
  group_by?: GroupingType;
  id?: string;
  indices?: string[];
  labels?: Record<string, any>;
  measurements?: Measurements;
  node_id?: string;
  phase_latency_map?: Record<string, any>;
  query_hashcode?: string;
  search_type?: string;
  source?: Source;
  task_resource_usages?: TaskResourceUsages[];
  timestamp?: number;
  total_shards?: number;
}

