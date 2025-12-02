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

export interface Ml_LoadModel_Request extends Global.Params {
  model_id: string;
}

export interface Ml_LoadModel_Response extends ApiResponse {
  body: Ml_LoadModel_ResponseBody;
}

export type Ml_LoadModel_ResponseBody = {
  status: string;
  task_id: string;
  task_type: 'BATCH_INGEST' | 'BATCH_PREDICTION' | 'DEPLOY_MODEL' | 'EXECUTION' | 'PREDICTION' | 'REGISTER_MODEL' | 'TRAINING' | 'TRAINING_AND_PREDICTION';
}

