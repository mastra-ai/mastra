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

export interface Ml_UploadModel_Request extends Global.Params {
  body?: Ml_UploadModel_RequestBody;
}

export type Ml_UploadModel_RequestBody = {
  description?: string;
  model_format?: Ml_Common.ModelFormat;
  model_group_id?: Common.Id;
  name: string;
  version: Common.VersionString;
}

export interface Ml_UploadModel_Response extends ApiResponse {
  body: Ml_UploadModel_ResponseBody;
}

export type Ml_UploadModel_ResponseBody = {
  status: string;
  task_id: string;
}

