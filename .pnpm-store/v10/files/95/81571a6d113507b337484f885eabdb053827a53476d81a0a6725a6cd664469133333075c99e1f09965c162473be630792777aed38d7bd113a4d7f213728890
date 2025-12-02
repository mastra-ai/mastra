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

export type ContinuousStats = {
  documents_behind?: Record<string, number>;
  last_timestamp?: number;
}

export type DateHistogramGroup = {
  calendar_interval?: string;
  fixed_interval?: string;
  source_field?: string;
  target_field?: string;
  timezone?: string;
}

export type DeletedTransformResponse = {
  _id: Common.Id;
  _index: string;
  _primary_term: number;
  _seq_no: Common.SequenceNumber;
  _shards: Common.ShardStatistics;
  _type?: Common.Type;
  _version: Common.VersionNumber;
  forced_refresh: boolean;
  result: string;
  status: number;
}

export type DeleteTransformResponseItem = {
  delete?: DeletedTransformResponse;
}

export type DeleteTransformsResponse = {
  errors?: boolean;
  items?: DeleteTransformResponseItem[];
  took?: number;
}

export type Explain = {
  metadata_id?: undefined | string;
  transform_metadata?: TransformMetadata | undefined;
}

export type ExplainResponse = Record<string, Explain>

export type ExplainStats = {
  documents_indexed?: number;
  documents_processed?: number;
  index_time_in_millis?: number;
  pages_processed?: number;
  search_time_in_millis?: number;
}

export type GroupsConfigItem = {
  date_histogram?: DateHistogramGroup;
  histogram?: HistogramGroup;
  terms?: TermsGroup;
}

export type HistogramGroup = {
  interval?: string;
  source_field?: string;
  target_field?: string;
}

export type Preview = {
  documents?: Record<string, any>[];
}

export type Schedule = {
  interval: ScheduleInterval;
}

export type ScheduleInterval = {
  period?: number;
  start_time?: number;
  unit?: string;
}

export type TermsGroup = {
  source_field?: string;
  target_field?: string;
}

export type Transform = {
  aggregations?: Record<string, GroupsConfigItem>;
  continuous?: boolean;
  data_selection_query?: Common_QueryDsl.QueryContainer;
  description?: string;
  enabled?: boolean;
  enabled_at?: undefined | number;
  groups?: GroupsConfigItem[];
  metadata_id?: undefined | string;
  page_size?: number;
  roles?: string[];
  schedule?: Schedule;
  schema_version?: number;
  source_index?: string;
  target_index?: string;
  transform_id?: string;
  updated_at?: number;
}

export type TransformMetadata = {
  continuous_stats?: ContinuousStats;
  failure_reason?: string;
  last_updated_at?: number;
  stats?: ExplainStats;
  status?: string;
  transform_id?: string;
}

export type TransformRequest = {
  transform: Transform;
}

export type TransformResponse = {
  _id?: Common.Id;
  _primary_term?: number;
  _seq_no?: Common.SequenceNumber;
  _version?: Common.VersionNumber;
  transform?: Transform;
}

export type TransformsResponse = {
  total_transforms?: number;
  transforms?: TransformResponse[];
}

