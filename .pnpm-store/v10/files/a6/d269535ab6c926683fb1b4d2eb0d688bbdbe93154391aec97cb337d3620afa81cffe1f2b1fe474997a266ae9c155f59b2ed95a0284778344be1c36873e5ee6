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

export interface Scroll_Request extends Global.Params {
  body?: Scroll_RequestBody;
  rest_total_hits_as_int?: boolean;
  scroll?: Common.Duration;
  scroll_id?: Common.ScrollId;
}

export type Scroll_RequestBody = {
  scroll?: Common.Duration;
  scroll_id?: Common.ScrollId;
}

export interface Scroll_Response extends ApiResponse {
  body: Scroll_ResponseBody;
}

export type Scroll_ResponseBody = Core_Search.ResponseBody

