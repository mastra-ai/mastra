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
import * as Core_Mtermvectors from '../_types/_core.mtermvectors'
import * as Global from '../_types/_global'

export interface Mtermvectors_Request extends Global.Params {
  body?: Mtermvectors_RequestBody;
  field_statistics?: boolean;
  fields?: Common.Fields;
  ids?: Common.Id[];
  index?: Common.IndexName;
  offsets?: boolean;
  payloads?: boolean;
  positions?: boolean;
  preference?: string;
  realtime?: boolean;
  routing?: Common.RoutingInQueryString;
  term_statistics?: boolean;
  version?: Common.VersionNumber;
  version_type?: Common.VersionType;
}

export type Mtermvectors_RequestBody = {
  docs?: Core_Mtermvectors.Operation[];
  ids?: Common.Id[];
}

export interface Mtermvectors_Response extends ApiResponse {
  body: Mtermvectors_ResponseBody;
}

export type Mtermvectors_ResponseBody = {
  docs: Core_Mtermvectors.TermVectorsResult[];
}

