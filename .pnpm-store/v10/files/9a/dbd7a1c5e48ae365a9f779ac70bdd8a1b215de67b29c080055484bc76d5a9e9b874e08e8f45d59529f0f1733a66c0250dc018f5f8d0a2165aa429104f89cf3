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
import * as Common_QueryDsl from '../_types/_common.query_dsl'
import * as Global from '../_types/_global'

export interface Indices_PutAlias_Request extends Global.Params {
  body?: Indices_PutAlias_RequestBody;
  cluster_manager_timeout?: Common.Duration;
  index?: Common.Indices;
  master_timeout?: Common.Duration;
  name?: Common.Name;
  timeout?: Common.Duration;
}

export type Indices_PutAlias_RequestBody = {
  alias?: string;
  filter?: Common_QueryDsl.QueryContainer;
  index?: string;
  index_routing?: Common.Routing;
  is_hidden?: boolean;
  is_write_index?: boolean;
  routing?: Common.Routing;
  search_routing?: Common.Routing;
}

export interface Indices_PutAlias_Response extends ApiResponse {
  body: Indices_PutAlias_ResponseBody;
}

export type Indices_PutAlias_ResponseBody = Common.AcknowledgedResponseBase

