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

export interface Index_Request extends Global.Params {
  body: Index_RequestBody;
  id?: Common.Id;
  if_primary_term?: number;
  if_seq_no?: Common.SequenceNumber;
  index: Common.IndexName;
  op_type?: Common.OpType;
  pipeline?: string;
  refresh?: Common.Refresh;
  require_alias?: boolean;
  routing?: Common.RoutingInQueryString;
  timeout?: Common.Duration;
  version?: Common.VersionNumber;
  version_type?: Common.VersionType;
  wait_for_active_shards?: Common.WaitForActiveShards;
}

export type Index_RequestBody = Record<string, any>

export interface Index_Response extends ApiResponse {
  body: Index_ResponseBody;
}

export type Index_ResponseBody = Common.WriteResponseBase

