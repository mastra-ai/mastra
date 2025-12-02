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
import * as Global from '../_types/_global'

export interface ExistsSource_Request extends Global.Params {
  _source?: Core_Search.SourceConfigParam;
  _source_excludes?: Common.Fields;
  _source_includes?: Common.Fields;
  id: Common.Id;
  index: Common.IndexName;
  preference?: string;
  realtime?: boolean;
  refresh?: Common.Refresh;
  routing?: Common.RoutingInQueryString;
  version?: Common.VersionNumber;
  version_type?: Common.VersionType;
}

export interface ExistsSource_Response extends ApiResponse {
  body: ExistsSource_ResponseBody;
}

export type ExistsSource_ResponseBody = boolean

