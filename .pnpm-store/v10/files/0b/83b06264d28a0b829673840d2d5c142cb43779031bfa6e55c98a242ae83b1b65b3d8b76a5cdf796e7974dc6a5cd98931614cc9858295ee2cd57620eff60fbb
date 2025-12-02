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
import * as Cat_Nodes from '../_types/cat.nodes'
import * as Common from '../_types/_common'
import * as Global from '../_types/_global'

export interface Cat_Nodes_Request extends Global.Params {
  bytes?: Common.ByteUnit;
  cluster_manager_timeout?: Common.Duration;
  format?: string;
  full_id?: Common.StringifiedBoolean;
  h?: string[];
  help?: boolean;
  local?: boolean;
  master_timeout?: Common.Duration;
  s?: string[];
  time?: Common.TimeUnit;
  v?: boolean;
}

export interface Cat_Nodes_Response extends ApiResponse {
  body: Cat_Nodes_ResponseBody;
}

export type Cat_Nodes_ResponseBody = Cat_Nodes.NodesRecord[]

