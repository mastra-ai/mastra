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
import * as Indices_Common from '../_types/indices._common'

export interface Indices_DataStreamsStats_Request extends Global.Params {
  name?: Common.Indices;
}

export interface Indices_DataStreamsStats_Response extends ApiResponse {
  body: Indices_DataStreamsStats_ResponseBody;
}

export type Indices_DataStreamsStats_ResponseBody = {
  _shards: Common.ShardStatistics;
  backing_indices: number;
  data_stream_count: number;
  data_streams: Indices_Common.DataStreamStats[];
  total_store_size?: Common.HumanReadableByteCount;
  total_store_size_bytes: Common.ByteCount;
}

