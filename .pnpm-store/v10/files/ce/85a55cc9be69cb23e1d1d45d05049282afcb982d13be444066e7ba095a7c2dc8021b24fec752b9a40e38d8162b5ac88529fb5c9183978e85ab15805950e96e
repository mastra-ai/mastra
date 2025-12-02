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
import * as RemoteStore_Common from '../_types/remote_store._common'

export interface RemoteStore_Restore_Request extends Global.Params {
  body: RemoteStore_Restore_RequestBody;
  cluster_manager_timeout?: Common.Duration;
  wait_for_completion?: boolean;
}

export type RemoteStore_Restore_RequestBody = {
  indices: string[];
}

export interface RemoteStore_Restore_Response extends ApiResponse {
  body: RemoteStore_Restore_ResponseBody;
}

export type RemoteStore_Restore_ResponseBody = {
  accepted?: boolean;
  remote_store?: RemoteStore_Common.RemoteStoreRestoreInfo;
}

