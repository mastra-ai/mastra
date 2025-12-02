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


export type FieldStatistics = {
  doc_count: number;
  sum_doc_freq: number;
  sum_ttf: number;
}

export type Filter = {
  max_doc_freq?: number;
  max_num_terms?: number;
  max_term_freq?: number;
  max_word_length?: number;
  min_doc_freq?: number;
  min_term_freq?: number;
  min_word_length?: number;
}

export type Term = {
  doc_freq?: number;
  score?: number;
  term_freq: number;
  tokens?: Token[];
  ttf?: number;
}

export type TermVector = {
  field_statistics?: FieldStatistics;
  terms: Record<string, Term>;
}

export type Token = {
  end_offset?: number;
  payload?: string;
  position: number;
  start_offset?: number;
}

