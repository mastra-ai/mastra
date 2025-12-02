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

export interface Ml_ExecuteAlgorithm_Request extends Global.Params {
  algorithm_name: 'anomaly_localization' | 'local_sample_calculator';
  body?: Ml_ExecuteAlgorithm_RequestBody;
}

export type Ml_ExecuteAlgorithm_RequestBody = {
  aggregations?: Ml_Common.Aggregation[];
  attribute_field_names?: string[];
  end_time?: number;
  index_name?: string;
  input_data?: number[];
  metrics?: number[][];
  min_time_interval?: number;
  num_outputs?: number;
  operation?: 'max' | 'min' | 'sum';
  start_time?: number;
  time_field_name?: string;
}

export interface Ml_ExecuteAlgorithm_Response extends ApiResponse {
  body: Ml_ExecuteAlgorithm_ResponseBody;
}

export type Ml_ExecuteAlgorithm_ResponseBody = Ml_Common.ExecuteAlgorithmResponse

