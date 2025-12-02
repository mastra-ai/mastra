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
import * as Core_Search from '../_types/_core.search'
import * as Core_Update from '../_types/_core.update'
import * as Global from '../_types/_global'

export interface Update_Request extends Global.Params {
  _source?: Core_Search.SourceConfigParam;
  _source_excludes?: Common.Fields;
  _source_includes?: Common.Fields;
  body: Update_RequestBody;
  id: Common.Id;
  if_primary_term?: number;
  if_seq_no?: Common.SequenceNumber;
  index: Common.IndexName;
  lang?: string;
  refresh?: Common.Refresh;
  require_alias?: boolean;
  retry_on_conflict?: number;
  routing?: Common.RoutingInQueryString;
  timeout?: Common.Duration;
  wait_for_active_shards?: Common.WaitForActiveShards;
}

export type Update_RequestBody = {
  _source?: Core_Search.SourceConfig;
  detect_noop?: boolean;
  doc?: Record<string, any>;
  doc_as_upsert?: boolean;
  script?: Common.Script;
  scripted_upsert?: boolean;
  upsert?: Record<string, any>;
}

export interface Update_Response extends ApiResponse {
  body: Update_ResponseBody;
}

export type Update_ResponseBody = Core_Update.UpdateWriteResponseBase

