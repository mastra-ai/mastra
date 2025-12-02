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
import * as Ml_Common from '../_types/ml._common'

export interface Ml_CreateConnector_Request extends Global.Params {
  body?: Ml_CreateConnector_RequestBody;
}

export type Ml_CreateConnector_RequestBody = {
  actions: Ml_Common.Action[];
  client_config?: Ml_Common.ClientConfig;
  credential: Ml_Common.Credential;
  description: string;
  name: string;
  parameters: Ml_Common.Parameters;
  protocol: 'aws_sigv4' | 'http';
  version: number;
}

export interface Ml_CreateConnector_Response extends ApiResponse {
  body: Ml_CreateConnector_ResponseBody;
}

export type Ml_CreateConnector_ResponseBody = {
  connector_id?: string;
}

