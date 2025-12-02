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
import * as Common_Analysis from '../_types/_common.analysis'
import * as Global from '../_types/_global'
import * as Indices_Analyze from '../_types/indices.analyze'

export interface Indices_Analyze_Request extends Global.Params {
  body?: Indices_Analyze_RequestBody;
  index?: Common.IndexName;
}

export type Indices_Analyze_RequestBody = {
  analyzer?: string;
  attributes?: string[];
  char_filter?: Common_Analysis.CharFilter[];
  explain?: boolean;
  field?: Common.Field;
  filter?: Common_Analysis.TokenFilter[];
  normalizer?: string;
  text?: Indices_Analyze.TextToAnalyze;
  tokenizer?: Common_Analysis.Tokenizer;
}

export interface Indices_Analyze_Response extends ApiResponse {
  body: Indices_Analyze_ResponseBody;
}

export type Indices_Analyze_ResponseBody = {
  detail?: Indices_Analyze.AnalyzeDetail;
  tokens?: Indices_Analyze.AnalyzeToken[];
}

