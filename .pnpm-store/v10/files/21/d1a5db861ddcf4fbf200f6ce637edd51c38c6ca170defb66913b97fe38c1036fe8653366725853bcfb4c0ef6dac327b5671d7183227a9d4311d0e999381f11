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
import * as Core_ScriptsPainlessExecute from '../_types/_core.scripts_painless_execute'
import * as Global from '../_types/_global'

export interface ScriptsPainlessExecute_Request extends Global.Params {
  body?: ScriptsPainlessExecute_RequestBody;
}

export type ScriptsPainlessExecute_RequestBody = {
  context?: string;
  context_setup?: Core_ScriptsPainlessExecute.PainlessContextSetup;
  script?: Common.InlineScript;
}

export interface ScriptsPainlessExecute_Response extends ApiResponse {
  body: ScriptsPainlessExecute_ResponseBody;
}

export type ScriptsPainlessExecute_ResponseBody = {
  result: number | string | boolean;
}

