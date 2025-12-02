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
import * as Global from '../_types/_global'
import * as Ml_Common from '../_types/ml._common'

export interface Ml_RegisterAgents_Request extends Global.Params {
  body?: Ml_RegisterAgents_RequestBody;
}

export type Ml_RegisterAgents_RequestBody = {
  app_type?: string;
  description?: string;
  llm?: Ml_Common.LLM;
  memory?: Ml_Common.Memory;
  name: string;
  parameters?: Ml_Common.Parameters;
  tools?: Ml_Common.ToolItems[];
  type: string;
}

export interface Ml_RegisterAgents_Response extends ApiResponse {
  body: Ml_RegisterAgents_ResponseBody;
}

export type Ml_RegisterAgents_ResponseBody = {
  agent_id?: string;
}

