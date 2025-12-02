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
import * as Cluster_State from '../_types/cluster.state'
import * as Common from '../_types/_common'
import * as Global from '../_types/_global'

export interface Cluster_State_Request extends Global.Params {
  allow_no_indices?: boolean;
  cluster_manager_timeout?: Common.Duration;
  expand_wildcards?: Common.ExpandWildcards;
  flat_settings?: boolean;
  ignore_unavailable?: boolean;
  index?: Common.Indices;
  local?: boolean;
  master_timeout?: Common.Duration;
  metric?: Cluster_State.Metric[];
  wait_for_metadata_version?: Common.VersionNumber;
  wait_for_timeout?: Common.Duration;
}

export interface Cluster_State_Response extends ApiResponse {
  body: Cluster_State_ResponseBody;
}

export type Cluster_State_ResponseBody = any

