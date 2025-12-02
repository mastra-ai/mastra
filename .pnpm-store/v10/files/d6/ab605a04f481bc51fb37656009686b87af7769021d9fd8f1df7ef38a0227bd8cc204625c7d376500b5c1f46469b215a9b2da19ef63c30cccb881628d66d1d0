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
import * as Core_UpdateByQueryRethrottle from '../_types/_core.update_by_query_rethrottle'
import * as Global from '../_types/_global'

export interface UpdateByQueryRethrottle_Request extends Global.Params {
  requests_per_second?: number;
  task_id: Common.Id;
}

export interface UpdateByQueryRethrottle_Response extends ApiResponse {
  body: UpdateByQueryRethrottle_ResponseBody;
}

export type UpdateByQueryRethrottle_ResponseBody = {
  node_failures?: Common.ErrorCause[];
  nodes: Record<string, Core_UpdateByQueryRethrottle.UpdateByQueryRethrottleNode>;
}

