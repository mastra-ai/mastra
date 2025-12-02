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
import * as Core_Explain from '../_types/_core.explain'
import * as Core_Search from '../_types/_core.search'
import * as Global from '../_types/_global'

export interface Explain_Request extends Global.Params {
  _source?: Core_Search.SourceConfigParam;
  _source_excludes?: Common.Fields;
  _source_includes?: Common.Fields;
  analyze_wildcard?: boolean;
  analyzer?: string;
  body?: Explain_RequestBody;
  default_operator?: Common_QueryDsl.Operator;
  df?: string;
  id: Common.Id;
  index: Common.IndexName;
  lenient?: boolean;
  preference?: string;
  q?: string;
  routing?: Common.RoutingInQueryString;
  stored_fields?: Common.Fields;
}

export type Explain_RequestBody = {
  query?: Common_QueryDsl.QueryContainer;
}

export interface Explain_Response extends ApiResponse {
  body: Explain_ResponseBody;
}

export type Explain_ResponseBody = {
  _id: Common.Id;
  _index: Common.IndexName;
  _type?: Common.Type;
  explanation?: Core_Explain.ExplanationDetail;
  get?: Common.InlineGet;
  matched: boolean;
}

