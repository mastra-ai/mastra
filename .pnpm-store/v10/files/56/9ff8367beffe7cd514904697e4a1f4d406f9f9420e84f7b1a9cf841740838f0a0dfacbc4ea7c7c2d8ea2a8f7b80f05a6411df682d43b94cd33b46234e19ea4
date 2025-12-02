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
import * as Common_Aggregations from './_common.aggregations'
import * as Common_QueryDsl from './_common.query_dsl'
import * as Core_Search from './_core.search'

export type AsynchronousSearchStats = {
  cancelled?: number;
  initialized?: number;
  persist_failed?: number;
  persisted?: number;
  rejected?: number;
  running_current?: number;
  search_completed?: number;
  search_failed?: number;
  submitted?: number;
}

export type NodesStats = {
  asynchronous_search_stats?: AsynchronousSearchStats;
}

export type ResponseBody = {
  expiration_time_in_millis?: number;
  id?: string;
  response?: Core_Search.ResponseBody;
  start_time_in_millis?: number;
  state?: string;
  took?: number;
}

export type Search = {
  _source?: Core_Search.SourceConfig;
  aggregations?: Record<string, Common_Aggregations.AggregationContainer>;
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
  rank?: Common.RankContainer;
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

export type StatsResponse = {
  _nodes?: Common.NodeStatistics;
  cluster_name?: string;
  nodes?: Record<string, NodesStats>;
}

