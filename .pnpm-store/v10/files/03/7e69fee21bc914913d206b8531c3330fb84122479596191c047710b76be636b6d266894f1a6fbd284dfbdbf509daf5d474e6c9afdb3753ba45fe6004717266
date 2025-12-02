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
import * as Indices_GetIndexTemplate from '../_types/indices.get_index_template'

export interface Indices_GetIndexTemplate_Request extends Global.Params {
  cluster_manager_timeout?: Common.Duration;
  flat_settings?: boolean;
  local?: boolean;
  master_timeout?: Common.Duration;
  name?: Common.Name;
}

export interface Indices_GetIndexTemplate_Response extends ApiResponse {
  body: Indices_GetIndexTemplate_ResponseBody;
}

export type Indices_GetIndexTemplate_ResponseBody = {
  index_templates: Indices_GetIndexTemplate.IndexTemplateItem[];
}

