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
import * as Indices_GetMapping from '../_types/indices.get_mapping'

export interface Indices_GetMapping_Request extends Global.Params {
  allow_no_indices?: boolean;
  cluster_manager_timeout?: Common.Duration;
  expand_wildcards?: Common.ExpandWildcards;
  ignore_unavailable?: boolean;
  index?: Common.Indices;
  local?: boolean;
  master_timeout?: Common.Duration;
}

export interface Indices_GetMapping_Response extends ApiResponse {
  body: Indices_GetMapping_ResponseBody;
}

export type Indices_GetMapping_ResponseBody = Record<string, Indices_GetMapping.IndexMappingRecord>

