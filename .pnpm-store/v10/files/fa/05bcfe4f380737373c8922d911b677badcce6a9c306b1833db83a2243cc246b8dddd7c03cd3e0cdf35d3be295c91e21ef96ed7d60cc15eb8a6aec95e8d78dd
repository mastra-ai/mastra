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
import * as Cluster_Stats from '../_types/cluster.stats'
import * as Common from '../_types/_common'
import * as Global from '../_types/_global'
import * as Nodes_Common from '../_types/nodes._common'

export interface Cluster_Stats_Request extends Global.Params {
  flat_settings?: boolean;
  index_metric?: Cluster_Stats.IndexMetric[];
  metric?: Cluster_Stats.Metric[];
  node_id?: Common.NodeIds;
  timeout?: Common.Duration;
}

export interface Cluster_Stats_Response extends ApiResponse {
  body: Cluster_Stats_ResponseBody;
}

export interface Cluster_Stats_ResponseBody extends Nodes_Common.NodesResponseBase {
  cluster_name: Common.Name;
  cluster_uuid: Common.Uuid;
  indices?: Cluster_Stats.ClusterIndices;
  nodes?: Cluster_Stats.ClusterNodes;
  status: Common.HealthStatus;
  timestamp: Common.EpochTimeUnitMillis;
}

