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

import { ApiResponse } from '../../lib/Transport'
import * as Common from '../_types/_common'
import * as Global from '../_types/_global'
import * as Indices_Stats from '../_types/indices.stats'

export interface Indices_Stats_Request extends Global.Params {
  completion_fields?: Common.Fields;
  expand_wildcards?: Common.ExpandWildcards;
  fielddata_fields?: Common.Fields;
  fields?: Common.Fields;
  forbid_closed_indices?: boolean;
  groups?: Common.StringOrStringArray;
  include_segment_file_sizes?: boolean;
  include_unloaded_segments?: boolean;
  index?: Common.Indices;
  level?: Common.Level;
  metric?: Indices_Stats.Metric | Indices_Stats.Metric[];
}

export interface Indices_Stats_Response extends ApiResponse {
  body: Indices_Stats_ResponseBody;
}

export type Indices_Stats_ResponseBody = {
  _all: Indices_Stats.AllIndicesStats;
  _shards: Common.ShardStatistics;
  indices?: Record<string, Indices_Stats.IndicesStats>;
}

