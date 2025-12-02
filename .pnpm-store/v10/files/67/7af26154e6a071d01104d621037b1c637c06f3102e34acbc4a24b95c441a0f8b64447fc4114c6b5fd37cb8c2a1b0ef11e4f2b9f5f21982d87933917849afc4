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
import * as Ingest_Common from '../_types/ingest._common'

export interface Ingest_PutPipeline_Request extends Global.Params {
  body: Ingest_PutPipeline_RequestBody;
  cluster_manager_timeout?: Common.Duration;
  id: Common.Id;
  master_timeout?: Common.Duration;
  timeout?: Common.Duration;
}

export type Ingest_PutPipeline_RequestBody = {
  _meta?: Common.Metadata;
  description?: string;
  on_failure?: Ingest_Common.ProcessorContainer[];
  processors?: Ingest_Common.ProcessorContainer[];
  version?: Common.VersionNumber;
}

export interface Ingest_PutPipeline_Response extends ApiResponse {
  body: Ingest_PutPipeline_ResponseBody;
}

export type Ingest_PutPipeline_ResponseBody = Common.AcknowledgedResponseBase

