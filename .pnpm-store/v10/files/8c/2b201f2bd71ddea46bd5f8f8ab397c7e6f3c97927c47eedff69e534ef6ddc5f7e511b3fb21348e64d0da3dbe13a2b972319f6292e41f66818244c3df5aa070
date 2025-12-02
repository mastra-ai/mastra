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
import * as Cat_Indices from '../_types/cat.indices'
import * as Common from '../_types/_common'
import * as Global from '../_types/_global'

export interface Cat_Indices_Request extends Global.Params {
  bytes?: Common.ByteUnit;
  cluster_manager_timeout?: Common.Duration;
  expand_wildcards?: Common.ExpandWildcards;
  format?: string;
  h?: string[];
  health?: Common.HealthStatus;
  help?: boolean;
  include_unloaded_segments?: boolean;
  index?: Common.Indices;
  local?: boolean;
  master_timeout?: Common.Duration;
  pri?: boolean;
  s?: string[];
  time?: Common.TimeUnit;
  v?: boolean;
}

export interface Cat_Indices_Response extends ApiResponse {
  body: Cat_Indices_ResponseBody;
}

export type Cat_Indices_ResponseBody = Cat_Indices.IndicesRecord[]

