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
import * as Core_Termvectors from '../_types/_core.termvectors'
import * as Global from '../_types/_global'

export interface Termvectors_Request extends Global.Params {
  body?: Termvectors_RequestBody;
  field_statistics?: boolean;
  fields?: Common.Fields;
  id?: Common.Id;
  index: Common.IndexName;
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

export type Termvectors_RequestBody = {
  doc?: Record<string, any>;
  filter?: Core_Termvectors.Filter;
  per_field_analyzer?: Record<string, string>;
}

export interface Termvectors_Response extends ApiResponse {
  body: Termvectors_ResponseBody;
}

export type Termvectors_ResponseBody = {
  _id?: Common.Id;
  _index: Common.IndexName;
  _type?: Common.Type;
  _version: Common.VersionNumber;
  found: boolean;
  term_vectors?: Record<string, Core_Termvectors.TermVector>;
  took: number;
}

