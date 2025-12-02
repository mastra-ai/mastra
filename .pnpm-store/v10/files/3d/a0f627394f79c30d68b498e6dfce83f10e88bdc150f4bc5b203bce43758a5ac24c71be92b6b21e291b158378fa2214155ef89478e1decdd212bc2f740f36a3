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
import * as Core_Msearch from '../_types/_core.msearch'
import * as Global from '../_types/_global'

export interface Msearch_Request extends Global.Params {
  body: Msearch_RequestBody;
  ccs_minimize_roundtrips?: boolean;
  index?: Common.Indices;
  max_concurrent_searches?: number;
  max_concurrent_shard_requests?: number;
  pre_filter_shard_size?: number;
  rest_total_hits_as_int?: boolean;
  search_type?: Common.SearchType;
  typed_keys?: boolean;
}

export type Msearch_RequestBody = Core_Msearch.RequestItem[]

export interface Msearch_Response extends ApiResponse {
  body: Msearch_ResponseBody;
}

export type Msearch_ResponseBody = Core_Msearch.MultiSearchResult

