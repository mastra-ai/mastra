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

export interface Indices_Open_Request extends Global.Params {
  allow_no_indices?: boolean;
  cluster_manager_timeout?: Common.Duration;
  expand_wildcards?: Common.ExpandWildcards;
  ignore_unavailable?: boolean;
  index: Common.Indices;
  master_timeout?: Common.Duration;
  task_execution_timeout?: Common.Duration;
  timeout?: Common.Duration;
  wait_for_active_shards?: Common.WaitForActiveShards;
  wait_for_completion?: boolean;
}

export interface Indices_Open_Response extends ApiResponse {
  body: Indices_Open_ResponseBody;
}

export type Indices_Open_ResponseBody = {
  task?: Common.TaskId;
} | {
  acknowledged: boolean;
  shards_acknowledged: boolean;
}

