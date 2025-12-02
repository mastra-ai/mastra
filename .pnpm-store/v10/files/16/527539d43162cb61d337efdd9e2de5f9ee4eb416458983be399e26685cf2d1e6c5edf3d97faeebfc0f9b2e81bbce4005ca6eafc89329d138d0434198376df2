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

import * as Common from './_common'

export type AnalyzeDetail = {
  analyzer?: AnalyzerDetail;
  charfilters?: CharFilterDetail[];
  custom_analyzer: boolean;
  tokenfilters?: TokenDetail[];
  tokenizer?: TokenDetail;
}

export type AnalyzerDetail = {
  name: string;
  tokens: ExplainAnalyzeToken[];
}

export type AnalyzeToken = {
  end_offset: number;
  position: number;
  positionLength?: number;
  start_offset: number;
  token: string;
  type: string;
}

export type CharFilterDetail = {
  filtered_text: string[];
  name: string;
}

export type ExplainAnalyzeToken = {
  bytes: string;
  end_offset: number;
  keyword?: boolean;
  position: number;
  positionLength: number;
  start_offset: number;
  termFrequency: number;
  token: string;
  type: string;
}

export type TextToAnalyze = Common.StringOrStringArray

export type TokenDetail = {
  name: string;
  tokens: ExplainAnalyzeToken[];
}

