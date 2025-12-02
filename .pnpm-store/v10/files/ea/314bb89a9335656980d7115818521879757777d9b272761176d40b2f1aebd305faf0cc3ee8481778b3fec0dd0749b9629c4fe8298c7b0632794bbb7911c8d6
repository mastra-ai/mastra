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
import * as Ingest_Simulate from '../_types/ingest.simulate'

export interface Ingest_Simulate_Request extends Global.Params {
  body: Ingest_Simulate_RequestBody;
  id?: Common.Id;
  verbose?: boolean;
}

export type Ingest_Simulate_RequestBody = {
  docs?: Ingest_Simulate.Document[];
  pipeline?: Ingest_Common.Pipeline;
}

export interface Ingest_Simulate_Response extends ApiResponse {
  body: Ingest_Simulate_ResponseBody;
}

export type Ingest_Simulate_ResponseBody = {
  docs: Ingest_Simulate.PipelineSimulation[];
}

