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
import * as Indices_ShardStores from '../_types/indices.shard_stores'

export interface Indices_ShardStores_Request extends Global.Params {
  allow_no_indices?: boolean;
  expand_wildcards?: Common.ExpandWildcards;
  ignore_unavailable?: boolean;
  index?: Common.Indices;
  status?: Indices_ShardStores.ShardStoreStatus | Indices_ShardStores.ShardStoreStatus[];
}

export interface Indices_ShardStores_Response extends ApiResponse {
  body: Indices_ShardStores_ResponseBody;
}

export type Indices_ShardStores_ResponseBody = {
  indices: Record<string, Indices_ShardStores.IndicesShardStores>;
}

