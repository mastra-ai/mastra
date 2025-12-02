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

export interface Ml_UpdateModel_Request extends Global.Params {
  body?: Ml_UpdateModel_RequestBody;
  model_id: string;
}

export type Ml_UpdateModel_RequestBody = {
  connector?: Record<string, any>;
  connector_id?: string;
  description?: string;
  guardrails?: Ml_Common.Guardrails;
  interface?: Record<string, any>;
  is_enabled?: boolean;
  model_config?: Ml_Common.ModelConfig;
  name?: string;
  rate_limiter?: Ml_Common.RateLimiter;
}

export interface Ml_UpdateModel_Response extends ApiResponse {
  body: Ml_UpdateModel_ResponseBody;
}

export type Ml_UpdateModel_ResponseBody = Common.WriteResponseBase

