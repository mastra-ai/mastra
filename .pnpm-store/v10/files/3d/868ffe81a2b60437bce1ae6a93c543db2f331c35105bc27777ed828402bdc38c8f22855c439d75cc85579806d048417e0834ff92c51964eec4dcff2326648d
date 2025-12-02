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
import * as Tasks_Common from '../_types/tasks._common'

export interface Tasks_Get_Request extends Global.Params {
  task_id: Common.Id;
  timeout?: Common.Duration;
  wait_for_completion?: boolean;
}

export interface Tasks_Get_Response extends ApiResponse {
  body: Tasks_Get_ResponseBody;
}

export type Tasks_Get_ResponseBody = {
  completed: boolean;
  error?: Common.ErrorCause;
  response?: Tasks_Common.TaskResponse;
  task: Tasks_Common.TaskInfo;
}

