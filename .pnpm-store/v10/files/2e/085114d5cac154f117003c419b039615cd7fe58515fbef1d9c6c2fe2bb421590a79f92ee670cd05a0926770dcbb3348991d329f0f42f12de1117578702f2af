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
import * as Core_ReindexRethrottle from '../_types/_core.reindex_rethrottle'
import * as Global from '../_types/_global'

export interface ReindexRethrottle_Request extends Global.Params {
  requests_per_second?: number;
  task_id: Common.Id;
}

export interface ReindexRethrottle_Response extends ApiResponse {
  body: ReindexRethrottle_ResponseBody;
}

export type ReindexRethrottle_ResponseBody = {
  nodes: Record<string, Core_ReindexRethrottle.ReindexNode>;
}

