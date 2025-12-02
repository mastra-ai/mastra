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
import * as Global from '../_types/_global'
import * as Indices_ValidateQuery from '../_types/indices.validate_query'

export interface Indices_ValidateQuery_Request extends Global.Params {
  all_shards?: boolean;
  allow_no_indices?: boolean;
  analyze_wildcard?: boolean;
  analyzer?: string;
  body?: Indices_ValidateQuery_RequestBody;
  default_operator?: Common_QueryDsl.Operator;
  df?: string;
  expand_wildcards?: Common.ExpandWildcards;
  explain?: boolean;
  ignore_unavailable?: boolean;
  index?: Common.Indices;
  lenient?: boolean;
  q?: string;
  rewrite?: boolean;
}

export type Indices_ValidateQuery_RequestBody = {
  query?: Common_QueryDsl.QueryContainer;
}

export interface Indices_ValidateQuery_Response extends ApiResponse {
  body: Indices_ValidateQuery_ResponseBody;
}

export type Indices_ValidateQuery_ResponseBody = {
  _shards?: Common.ShardStatistics;
  error?: string;
  explanations?: Indices_ValidateQuery.IndicesValidationExplanation[];
  valid: boolean;
}

