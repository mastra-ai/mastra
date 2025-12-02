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
import * as Common_QueryDsl from '../_types/_common.query_dsl'
import * as Core_Search from '../_types/_core.search'
import * as Global from '../_types/_global'

export interface UpdateByQuery_Request extends Global.Params {
  _source?: Core_Search.SourceConfigParam;
  _source_excludes?: string[];
  _source_includes?: string[];
  allow_no_indices?: boolean;
  analyze_wildcard?: boolean;
  analyzer?: string;
  body?: UpdateByQuery_RequestBody;
  conflicts?: Common.Conflicts;
  default_operator?: Common_QueryDsl.Operator;
  df?: string;
  expand_wildcards?: Common.ExpandWildcards;
  from?: number;
  ignore_unavailable?: boolean;
  index: Common.Indices;
  lenient?: boolean;
  max_docs?: number;
  pipeline?: string;
  preference?: string;
  q?: string;
  refresh?: Common.Refresh;
  request_cache?: boolean;
  requests_per_second?: number;
  routing?: Common.RoutingInQueryString;
  scroll?: Common.Duration;
  scroll_size?: number;
  search_timeout?: Common.Duration;
  search_type?: Common.SearchType;
  size?: number;
  slices?: Common.Slices;
  sort?: string[];
  stats?: string[];
  terminate_after?: number;
  timeout?: Common.Duration;
  version?: boolean;
  wait_for_active_shards?: Common.WaitForActiveShards;
  wait_for_completion?: boolean;
}

export type UpdateByQuery_RequestBody = {
  conflicts?: Common.Conflicts;
  max_docs?: number;
  query?: Common_QueryDsl.QueryContainer;
  script?: Common.Script;
  slice?: Common.SlicedScroll;
}

export interface UpdateByQuery_Response extends ApiResponse {
  body: UpdateByQuery_ResponseBody;
}

export type UpdateByQuery_ResponseBody = Common.BulkByScrollResponseBase | {
  task?: Common.TaskId;
}

