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
import * as DanglingIndices_ListDanglingIndices from '../_types/dangling_indices.list_dangling_indices'
import * as Global from '../_types/_global'

export type DanglingIndices_ListDanglingIndices_Request = Global.Params & Record<string, any>

export interface DanglingIndices_ListDanglingIndices_Response extends ApiResponse {
  body: DanglingIndices_ListDanglingIndices_ResponseBody;
}

export type DanglingIndices_ListDanglingIndices_ResponseBody = {
  _nodes?: Common.NodeStatistics;
  cluster_name?: Common.Name;
  dangling_indices: DanglingIndices_ListDanglingIndices.DanglingIndex[];
}

