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
import * as Ml_Common from '../_types/ml._common'

export interface Ml_CreateMessage_Request extends Global.Params {
  body?: Ml_CreateMessage_RequestBody;
  memory_id: string;
}

export type Ml_CreateMessage_RequestBody = {
  additional_info?: Ml_Common.AdditionalInfo;
  input?: string;
  origin?: string;
  prompt_template?: string;
  response?: string;
}

export interface Ml_CreateMessage_Response extends ApiResponse {
  body: Ml_CreateMessage_ResponseBody;
}

export type Ml_CreateMessage_ResponseBody = {
  message_id: Common.Name;
}

