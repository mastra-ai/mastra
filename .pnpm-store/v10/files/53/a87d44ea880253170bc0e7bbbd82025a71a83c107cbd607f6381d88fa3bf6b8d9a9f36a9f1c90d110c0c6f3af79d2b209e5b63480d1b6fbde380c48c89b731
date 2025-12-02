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

export interface Indices_Forcemerge_Request extends Global.Params {
  allow_no_indices?: boolean;
  expand_wildcards?: Common.ExpandWildcards;
  flush?: boolean;
  ignore_unavailable?: boolean;
  index?: Common.Indices;
  max_num_segments?: number;
  only_expunge_deletes?: boolean;
  primary_only?: boolean;
  wait_for_completion?: boolean;
}

export interface Indices_Forcemerge_Response extends ApiResponse {
  body: Indices_Forcemerge_ResponseBody;
}

export interface Indices_Forcemerge_ResponseBody extends Common.ShardsOperationResponseBase {
  task?: string;
}

