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
import * as Snapshot_Common from '../_types/snapshot._common'

export interface Snapshot_Create_Request extends Global.Params {
  body?: Snapshot_Create_RequestBody;
  cluster_manager_timeout?: Common.Duration;
  master_timeout?: Common.Duration;
  repository: Common.Name;
  snapshot: Common.Name;
  wait_for_completion?: boolean;
}

export type Snapshot_Create_RequestBody = {
  feature_states?: string[];
  ignore_unavailable?: boolean;
  include_global_state?: boolean;
  indices?: Common.Indices;
  metadata?: Common.Metadata;
  partial?: boolean;
}

export interface Snapshot_Create_Response extends ApiResponse {
  body: Snapshot_Create_ResponseBody;
}

export type Snapshot_Create_ResponseBody = {
  accepted?: boolean;
  snapshot?: Snapshot_Common.SnapshotInfo;
}

