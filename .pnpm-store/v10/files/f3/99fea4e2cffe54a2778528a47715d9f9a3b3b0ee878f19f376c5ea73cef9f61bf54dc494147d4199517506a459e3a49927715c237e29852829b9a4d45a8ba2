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
import * as Cluster_Common from '../_types/cluster._common'
import * as Common from '../_types/_common'
import * as Global from '../_types/_global'

export interface Cluster_GetComponentTemplate_Request extends Global.Params {
  cluster_manager_timeout?: Common.Duration;
  flat_settings?: boolean;
  local?: boolean;
  master_timeout?: Common.Duration;
  name?: Common.Name;
}

export interface Cluster_GetComponentTemplate_Response extends ApiResponse {
  body: Cluster_GetComponentTemplate_ResponseBody;
}

export type Cluster_GetComponentTemplate_ResponseBody = {
  component_templates: Cluster_Common.ComponentTemplate[];
}

