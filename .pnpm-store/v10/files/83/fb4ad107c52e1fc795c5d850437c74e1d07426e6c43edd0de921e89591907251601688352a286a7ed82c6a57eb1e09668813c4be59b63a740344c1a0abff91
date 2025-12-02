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
import * as Cat_SegmentReplication from '../_types/cat.segment_replication'
import * as Common from '../_types/_common'
import * as Global from '../_types/_global'

export interface Cat_SegmentReplication_Request extends Global.Params {
  active_only?: boolean;
  allow_no_indices?: boolean;
  bytes?: Common.ByteUnit;
  completed_only?: boolean;
  detailed?: boolean;
  expand_wildcards?: Common.ExpandWildcards;
  format?: string;
  h?: string[];
  help?: boolean;
  ignore_throttled?: boolean;
  ignore_unavailable?: boolean;
  index?: string[];
  s?: string[];
  shards?: string[];
  time?: Common.TimeUnit;
  timeout?: Common.Duration;
  v?: boolean;
}

export interface Cat_SegmentReplication_Response extends ApiResponse {
  body: Cat_SegmentReplication_ResponseBody;
}

export type Cat_SegmentReplication_ResponseBody = Cat_SegmentReplication.SegmentReplicationRecord[]

