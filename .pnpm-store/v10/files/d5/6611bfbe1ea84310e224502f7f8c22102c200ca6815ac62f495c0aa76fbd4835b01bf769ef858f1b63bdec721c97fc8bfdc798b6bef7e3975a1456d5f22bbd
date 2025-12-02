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

export interface Snapshot_GetRepository_Request extends Global.Params {
  cluster_manager_timeout?: Common.Duration;
  local?: boolean;
  master_timeout?: Common.Duration;
  repository?: Common.Names;
}

export interface Snapshot_GetRepository_Response extends ApiResponse {
  body: Snapshot_GetRepository_ResponseBody;
}

export type Snapshot_GetRepository_ResponseBody = Record<string, Snapshot_Common.Repository>

