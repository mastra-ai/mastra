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
import * as Indices_Common from '../_types/indices._common'
import * as Indices_PutIndexTemplate from '../_types/indices.put_index_template'

export interface Indices_PutIndexTemplate_Request extends Global.Params {
  body: Indices_PutIndexTemplate_RequestBody;
  cause?: string;
  cluster_manager_timeout?: Common.Duration;
  create?: boolean;
  master_timeout?: Common.Duration;
  name: Common.Name;
}

export type Indices_PutIndexTemplate_RequestBody = {
  _meta?: Common.Metadata;
  composed_of?: Common.Name[];
  data_stream?: Indices_Common.IndexTemplateDataStreamConfiguration;
  index_patterns?: Common.Indices;
  priority?: number;
  template?: Indices_PutIndexTemplate.IndexTemplateMapping;
  version?: Common.VersionNumber;
}

export interface Indices_PutIndexTemplate_Response extends ApiResponse {
  body: Indices_PutIndexTemplate_ResponseBody;
}

export type Indices_PutIndexTemplate_ResponseBody = Common.AcknowledgedResponseBase

