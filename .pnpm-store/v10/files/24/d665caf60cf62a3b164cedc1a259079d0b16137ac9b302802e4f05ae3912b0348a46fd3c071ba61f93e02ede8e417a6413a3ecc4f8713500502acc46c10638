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
import * as Common_Mapping from '../_types/_common.mapping'
import * as Global from '../_types/_global'
import * as Indices_Common from '../_types/indices._common'
import * as Indices_Rollover from '../_types/indices.rollover'

export interface Indices_Rollover_Request extends Global.Params {
  alias: Common.IndexAlias;
  body?: Indices_Rollover_RequestBody;
  cluster_manager_timeout?: Common.Duration;
  dry_run?: boolean;
  master_timeout?: Common.Duration;
  new_index?: Common.IndexName;
  timeout?: Common.Duration;
  wait_for_active_shards?: Common.WaitForActiveShards;
}

export type Indices_Rollover_RequestBody = {
  aliases?: Record<string, Indices_Common.Alias>;
  conditions?: Indices_Rollover.RolloverConditions;
  mappings?: Common_Mapping.TypeMapping;
  settings?: Record<string, any>;
}

export interface Indices_Rollover_Response extends ApiResponse {
  body: Indices_Rollover_ResponseBody;
}

export interface Indices_Rollover_ResponseBody extends Common.AcknowledgedResponseBase {
  conditions: Record<string, boolean>;
  dry_run: boolean;
  new_index: string;
  old_index: string;
  rolled_over: boolean;
  shards_acknowledged: boolean;
}

