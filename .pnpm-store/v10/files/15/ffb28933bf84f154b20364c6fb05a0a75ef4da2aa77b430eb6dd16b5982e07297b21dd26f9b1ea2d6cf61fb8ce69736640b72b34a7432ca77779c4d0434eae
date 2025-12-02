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
import * as Nodes_Common from '../_types/nodes._common'
import * as Nodes_Usage from '../_types/nodes.usage'

export interface Nodes_Usage_Request extends Global.Params {
  metric?: Nodes_Usage.Metric[];
  node_id?: Common.NodeIds;
  timeout?: Common.Duration;
}

export interface Nodes_Usage_Response extends ApiResponse {
  body: Nodes_Usage_ResponseBody;
}

export interface Nodes_Usage_ResponseBody extends Nodes_Common.NodesResponseBase {
  cluster_name: Common.Name;
  nodes: Record<string, Nodes_Usage.NodeUsage>;
}

