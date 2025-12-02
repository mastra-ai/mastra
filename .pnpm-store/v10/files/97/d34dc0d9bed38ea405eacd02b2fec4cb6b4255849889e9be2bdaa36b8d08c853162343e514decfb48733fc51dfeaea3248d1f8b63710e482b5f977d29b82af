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
import * as Cluster_Health from '../_types/cluster.health'
import * as Common from '../_types/_common'
import * as Global from '../_types/_global'

export interface Cluster_Health_Request extends Global.Params {
  awareness_attribute?: string;
  cluster_manager_timeout?: Common.Duration;
  expand_wildcards?: Common.ExpandWildcards;
  index?: Common.Indices;
  level?: Cluster_Health.Level;
  local?: boolean;
  master_timeout?: Common.Duration;
  timeout?: Common.Duration;
  wait_for_active_shards?: Common.WaitForActiveShards;
  wait_for_events?: Common.WaitForEvents;
  wait_for_no_initializing_shards?: boolean;
  wait_for_no_relocating_shards?: boolean;
  wait_for_nodes?: string | number;
  wait_for_status?: Common.HealthStatus;
}

export interface Cluster_Health_Response extends ApiResponse {
  body: Cluster_Health_ResponseBody;
}

export type Cluster_Health_ResponseBody = Cluster_Health.HealthResponseBody

