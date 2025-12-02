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
import * as Indices_Common from '../_types/indices._common'
import * as Snapshot_Restore from '../_types/snapshot.restore'

export interface Snapshot_Restore_Request extends Global.Params {
  body?: Snapshot_Restore_RequestBody;
  cluster_manager_timeout?: Common.Duration;
  master_timeout?: Common.Duration;
  repository: Common.Name;
  snapshot: Common.Name;
  wait_for_completion?: boolean;
}

export type Snapshot_Restore_RequestBody = {
  ignore_index_settings?: string[];
  ignore_unavailable?: boolean;
  include_aliases?: boolean;
  include_global_state?: boolean;
  index_settings?: Indices_Common.IndexSettings;
  indices?: Common.Indices;
  partial?: boolean;
  rename_alias_pattern?: string;
  rename_alias_replacement?: string;
  rename_pattern?: string;
  rename_replacement?: string;
  source_remote_store_repository?: string;
  storage_type?: string;
}

export interface Snapshot_Restore_Response extends ApiResponse {
  body: Snapshot_Restore_ResponseBody;
}

export type Snapshot_Restore_ResponseBody = {
  accepted?: boolean;
  snapshot?: Snapshot_Restore.SnapshotRestore;
}

