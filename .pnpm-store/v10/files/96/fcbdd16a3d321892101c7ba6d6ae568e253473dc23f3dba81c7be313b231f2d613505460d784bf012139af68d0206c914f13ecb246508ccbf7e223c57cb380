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

import * as Common_QueryDsl from './_common.query_dsl'

export type CollapseResponseProcessor = {
  context_prefix?: string;
  description?: string;
  field: string;
  ignore_failure?: boolean;
  tag?: string;
}

export type FilterQueryRequestProcessor = {
  description?: string;
  ignore_failure?: boolean;
  query?: Common_QueryDsl.QueryContainer;
  tag?: string;
}

export type MLOpenSearchReranker = {
  model_id: string;
}

export type NeuralFieldMap = Record<string, string>

export type NeuralQueryEnricherRequestProcessor = {
  default_model_id?: string;
  description?: string;
  neural_field_default_id?: NeuralFieldMap;
  tag?: string;
}

export type NormalizationPhaseResultsProcessor = {
  combination?: ScoreCombination;
  description?: string;
  ignore_failure?: boolean;
  normalization?: ScoreNormalization;
  tag?: string;
}

export type OversampleRequestProcessor = {
  content_prefix?: string;
  description?: string;
  ignore_failure?: boolean;
  sample_factor: number;
  tag?: string;
}

export type PersonalizeSearchRankingResponseProcessor = {
  campaign_arn: string;
  description?: string;
  iam_role_arn?: string;
  ignore_failure?: boolean;
  item_id_field?: string;
  recipe: string;
  tag?: string;
  weight: number;
}

export type PhaseResultsProcessor = {
  'normalization-processor': NormalizationPhaseResultsProcessor;
}

export type RenameFieldResponseProcessor = {
  description?: string;
  field: string;
  ignore_failure?: boolean;
  tag?: string;
  target_field: string;
}

export type RequestProcessor = {
  filter_query: FilterQueryRequestProcessor;
} | {
  neural_query_enricher: NeuralQueryEnricherRequestProcessor;
} | {
  script: SearchScriptRequestProcessor;
} | {
  oversample: OversampleRequestProcessor;
}

export type RerankContext = {
  document_fields: string[];
}

export type RerankResponseProcessor = {
  context?: RerankContext;
  description?: string;
  ignore_failure?: boolean;
  ml_opensearch?: MLOpenSearchReranker;
  tag?: string;
}

export type ResponseProcessor = {
  personalize_search_ranking: PersonalizeSearchRankingResponseProcessor;
} | {
  retrieval_augmented_generation: RetrievalAugmentedGenerationResponseProcessor;
} | {
  rename_field: RenameFieldResponseProcessor;
} | {
  rerank: RerankResponseProcessor;
} | {
  collapse: CollapseResponseProcessor;
} | {
  truncate_hits: TruncateHitsResponseProcessor;
} | {
  sort: SortResponseProcessor;
} | {
  split: SplitResponseProcessor;
}

export type RetrievalAugmentedGenerationResponseProcessor = {
  context_field_list: string[];
  description?: string;
  model_id: string;
  system_prompt?: string;
  tag?: string;
  user_instructions?: string;
}

export type ScoreCombination = {
  parameters?: number[];
  technique?: ScoreCombinationTechnique;
}

export type ScoreCombinationTechnique = 'arithmetic_mean' | 'geometric_mean' | 'harmonic_mean'

export type ScoreNormalization = {
  technique?: ScoreNormalizationTechnique;
}

export type ScoreNormalizationTechnique = 'l2' | 'min_max'

export type SearchPipelineMap = Record<string, SearchPipelineStructure>

export type SearchPipelineStructure = {
  phase_results_processors?: PhaseResultsProcessor[];
  request_processors?: RequestProcessor[];
  response_processors?: ResponseProcessor[];
  version?: number;
}

export type SearchScriptRequestProcessor = {
  description?: string;
  ignore_failure?: boolean;
  lang?: string;
  source: string;
  tag?: string;
}

export type SortResponseProcessor = {
  description?: string;
  field: string;
  ignore_failure?: boolean;
  order?: string;
  tag?: string;
  target_field?: string;
}

export type SplitResponseProcessor = {
  description?: string;
  field: string;
  ignore_failure?: boolean;
  preserve_trailing?: boolean;
  separator: string;
  tag?: string;
  target_field?: string;
}

export type TruncateHitsResponseProcessor = {
  context_prefix?: string;
  description?: string;
  ignore_failure?: boolean;
  tag?: string;
  target_size?: number;
}

