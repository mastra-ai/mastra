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
import * as Ltr_Common from '../_types/ltr._common'

export interface Ltr_Stats_Request extends Global.Params {
  node_id?: string[];
  stat?: 'cache' | 'request_error_count' | 'request_total_count'[];
  timeout?: Common.Duration;
}

export interface Ltr_Stats_Response extends ApiResponse {
  body: Ltr_Stats_ResponseBody;
}

export type Ltr_Stats_ResponseBody = Ltr_Common.Stats

