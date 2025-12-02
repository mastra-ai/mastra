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
import * as Core_RankEval from '../_types/_core.rank_eval'
import * as Global from '../_types/_global'

export interface RankEval_Request extends Global.Params {
  allow_no_indices?: boolean;
  body: RankEval_RequestBody;
  expand_wildcards?: Common.ExpandWildcards;
  ignore_unavailable?: boolean;
  index?: Common.Indices;
  search_type?: Common.SearchType;
}

export type RankEval_RequestBody = {
  metric?: Core_RankEval.RankEvalMetric;
  requests: Core_RankEval.RankEvalRequestItem[];
}

export interface RankEval_Response extends ApiResponse {
  body: RankEval_ResponseBody;
}

export type RankEval_ResponseBody = {
  details: Record<string, Core_RankEval.RankEvalMetricDetail>;
  failures: Record<string, any>;
  metric_score: number;
}

