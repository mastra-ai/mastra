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
import * as Core_SearchShards from '../_types/_core.search_shards'
import * as Global from '../_types/_global'

export interface SearchShards_Request extends Global.Params {
  allow_no_indices?: boolean;
  expand_wildcards?: Common.ExpandWildcards;
  ignore_unavailable?: boolean;
  index?: Common.Indices;
  local?: boolean;
  preference?: string;
  routing?: Common.RoutingInQueryString;
}

export interface SearchShards_Response extends ApiResponse {
  body: SearchShards_ResponseBody;
}

export type SearchShards_ResponseBody = {
  indices: Record<string, Core_SearchShards.ShardStoreIndex>;
  nodes: Record<string, Common.NodeAttributes>;
  shards: Common.NodeShard[][];
}

