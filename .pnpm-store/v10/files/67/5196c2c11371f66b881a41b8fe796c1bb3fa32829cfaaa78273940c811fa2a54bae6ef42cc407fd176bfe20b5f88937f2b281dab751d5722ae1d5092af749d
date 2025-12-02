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
import * as Cat_Segments from '../_types/cat.segments'
import * as Common from '../_types/_common'
import * as Global from '../_types/_global'

export interface Cat_PitSegments_Request extends Global.Params {
  body?: Cat_PitSegments_RequestBody;
  bytes?: Common.ByteUnit;
  format?: string;
  h?: string[];
  help?: boolean;
  s?: string[];
  v?: boolean;
}

export type Cat_PitSegments_RequestBody = {
  pit_id: string[];
}

export interface Cat_PitSegments_Response extends ApiResponse {
  body: Cat_PitSegments_ResponseBody;
}

export type Cat_PitSegments_ResponseBody = Cat_Segments.SegmentsRecord[]

