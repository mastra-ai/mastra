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

export interface Ml_UpdateConnector_Request extends Global.Params {
  body?: Ml_UpdateConnector_RequestBody;
  connector_id: string;
}

export type Ml_UpdateConnector_RequestBody = {
  access_mode?: 'private' | 'public' | 'restricted';
  actions?: Ml_Common.Action[];
  backend_roles?: string[];
  credential?: Ml_Common.Credential;
  description?: string;
  name?: Common.Name;
  parameters?: Ml_Common.Parameters;
  'parameters.skip_validating_missing_parameters'?: boolean;
  protocol?: 'aws_sigv4' | 'http';
  version?: Common.VersionNumber;
}

export interface Ml_UpdateConnector_Response extends ApiResponse {
  body: Ml_UpdateConnector_ResponseBody;
}

export type Ml_UpdateConnector_ResponseBody = Common.WriteResponseBase

