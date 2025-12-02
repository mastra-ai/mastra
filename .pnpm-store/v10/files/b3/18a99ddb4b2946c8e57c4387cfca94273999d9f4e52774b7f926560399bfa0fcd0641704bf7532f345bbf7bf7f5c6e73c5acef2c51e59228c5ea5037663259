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
import * as Cat_Recovery from '../_types/cat.recovery'
import * as Common from '../_types/_common'
import * as Global from '../_types/_global'

export interface Cat_Recovery_Request extends Global.Params {
  active_only?: boolean;
  bytes?: Common.ByteUnit;
  detailed?: boolean;
  format?: string;
  h?: string[];
  help?: boolean;
  index?: Common.Indices;
  s?: string[];
  time?: Common.TimeUnit;
  v?: boolean;
}

export interface Cat_Recovery_Response extends ApiResponse {
  body: Cat_Recovery_ResponseBody;
}

export type Cat_Recovery_ResponseBody = Cat_Recovery.RecoveryRecord[]

