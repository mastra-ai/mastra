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

export interface Cluster_PutComponentTemplate_Request extends Global.Params {
  body: Cluster_PutComponentTemplate_RequestBody;
  cluster_manager_timeout?: Common.Duration;
  create?: boolean;
  master_timeout?: Common.Duration;
  name: Common.Name;
  timeout?: Common.Duration;
}

export type Cluster_PutComponentTemplate_RequestBody = {
  _meta?: Common.Metadata;
  allow_auto_create?: boolean;
  template: Indices_Common.IndexState;
  version?: Common.VersionNumber;
}

export interface Cluster_PutComponentTemplate_Response extends ApiResponse {
  body: Cluster_PutComponentTemplate_ResponseBody;
}

export type Cluster_PutComponentTemplate_ResponseBody = Common.AcknowledgedResponseBase

