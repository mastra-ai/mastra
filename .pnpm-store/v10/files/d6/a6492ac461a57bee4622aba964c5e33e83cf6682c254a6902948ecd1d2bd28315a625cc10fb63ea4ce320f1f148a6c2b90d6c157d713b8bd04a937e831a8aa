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

export interface Nodes_HotThreads_Request extends Global.Params {
  ignore_idle_threads?: boolean;
  interval?: Common.Duration;
  node_id?: string[];
  snapshots?: number;
  threads?: number;
  timeout?: Common.Duration;
  type?: Nodes_Common.SampleType;
}

export interface Nodes_HotThreads_Response extends ApiResponse {
  body: Nodes_HotThreads_ResponseBody;
}

export type Nodes_HotThreads_ResponseBody = Record<string, any>

