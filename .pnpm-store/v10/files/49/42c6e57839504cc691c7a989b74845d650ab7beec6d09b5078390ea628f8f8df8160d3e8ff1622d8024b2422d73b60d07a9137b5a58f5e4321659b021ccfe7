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

export interface Create_Request extends Global.Params {
  body: Create_RequestBody;
  id: Common.Id;
  index: Common.IndexName;
  pipeline?: string;
  refresh?: Common.Refresh;
  routing?: Common.RoutingInQueryString;
  timeout?: Common.Duration;
  version?: Common.VersionNumber;
  version_type?: Common.VersionType;
  wait_for_active_shards?: Common.WaitForActiveShards;
}

export type Create_RequestBody = Record<string, any>

export interface Create_Response extends ApiResponse {
  body: Create_ResponseBody;
}

export type Create_ResponseBody = Common.WriteResponseBase

