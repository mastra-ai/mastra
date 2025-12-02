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
import * as Common_Aggregations from './_common.aggregations'
import * as Common_Analysis from './_common.analysis'
import * as Common_QueryDsl from './_common.query_dsl'
import * as Core_Explain from './_core.explain'

export type AggregationBreakdown = {
  build_aggregation: number;
  build_aggregation_count: number;
  build_leaf_collector: number;
  build_leaf_collector_count: number;
  collect: number;
  collect_count: number;
  initialize: number;
  initialize_count: number;
  post_collection?: number;
  post_collection_count?: number;
  reduce: number;
  reduce_count: number;
}

export type AggregationProfile = {
  breakdown: AggregationBreakdown;
  children?: AggregationProfile[];
  debug?: AggregationProfileDebug;
  description: string;
  time_in_nanos: Common.DurationValueUnitNanos;
  type: string;
}

export type AggregationProfileDebug = {
  built_buckets?: number;
  chars_fetched?: number;
  collect_analyzed_count?: number;
  collect_analyzed_ns?: number;
  collection_strategy?: string;
  deferred_aggregators?: string[];
  delegate?: string;
  delegate_debug?: AggregationProfileDelegateDebug;
  empty_collectors_used?: number;
  extract_count?: number;
  extract_ns?: number;
  has_filter?: boolean;
  map_reducer?: string;
  numeric_collectors_used?: number;
  ordinals_collectors_overhead_too_high?: number;
  ordinals_collectors_used?: number;
  result_strategy?: string;
  segments_with_multi_valued_ords?: number;
  segments_with_single_valued_ords?: number;
  string_hashing_collectors_used?: number;
  surviving_buckets?: number;
  total_buckets?: number;
  values_fetched?: number;
}

export type AggregationProfileDelegateDebug = {
  filters?: AggregationProfileDelegateDebugFilter[];
  segments_collected?: number;
  segments_counted?: number;
  segments_with_deleted_docs?: number;
  segments_with_doc_count_field?: number;
}

export type AggregationProfileDelegateDebugFilter = {
  query?: string;
  results_from_metadata?: number;
  segments_counted_in_constant_time?: number;
  specialized_for?: string;
}

export type BoundaryScanner = 'chars' | 'sentence' | 'word'

export type BuiltinHighlighterType = 'plain' | 'fvh' | 'unified'

export type Collector = {
  children?: Collector[];
  name: string;
  reason: string;
  time_in_nanos: Common.DurationValueUnitNanos;
}

export type CompletionContext = Context | {
  boost?: number;
  context: Context;
  neighbours?: Common.GeoHashPrecision[];
  precision?: Common.GeoHashPrecision;
  prefix?: boolean;
}

export type CompletionSuggest = SuggestBase & {
  options: CompletionSuggestOption | CompletionSuggestOption[];
}

export type CompletionSuggester = SuggesterBase & {
  contexts?: Record<string, CompletionContext[]>;
  fuzzy?: SuggestFuzziness;
  regex?: string;
  skip_duplicates?: boolean;
}

export type CompletionSuggestOption = {
  _id?: string;
  _index?: Common.IndexName;
  _routing?: Common.Routing;
  _score?: number;
  _source?: Record<string, any>;
  collate_match?: boolean;
  contexts?: Record<string, Context[]>;
  fields?: Record<string, Record<string, any>>;
  score?: number;
  text: string;
}

export type Context = string | Common.GeoLocation

export type DirectGenerator = {
  field: string;
  max_edits?: number;
  max_inspections?: number;
  max_term_freq?: number;
  min_doc_freq?: number;
  min_word_length?: number;
  post_filter?: string;
  pre_filter?: string;
  prefix_length?: number;
  size?: number;
  suggest_mode?: Common.SuggestMode;
}

export type FetchProfile = {
  breakdown: FetchProfileBreakdown;
  children?: FetchProfile[];
  debug?: FetchProfileDebug;
  description: string;
  time_in_nanos: Common.DurationValueUnitNanos;
  type: string;
}

export type FetchProfileBreakdown = {
  load_source?: number;
  load_source_count?: number;
  load_stored_fields?: number;
  load_stored_fields_count?: number;
  next_reader?: number;
  next_reader_count?: number;
  process?: number;
  process_count?: number;
}

export type FetchProfileDebug = {
  fast_path?: number;
  stored_fields?: string[];
}

export type FieldCollapse = {
  field: Common.Field;
  inner_hits?: InnerHits | InnerHits[];
  max_concurrent_group_searches?: number;
}

export type FieldSuggester = {
  completion?: CompletionSuggester;
  phrase?: PhraseSuggester;
  prefix?: string;
  regex?: string;
  term?: TermSuggester;
  text?: string;
}

export type Highlight = HighlightBase & {
  encoder?: HighlighterEncoder;
  fields: Record<string, HighlightField>;
}

export type HighlightBase = {
  boundary_chars?: string;
  boundary_max_scan?: number;
  boundary_scanner?: BoundaryScanner;
  boundary_scanner_locale?: string;
  force_source?: boolean;
  fragment_offset?: number;
  fragment_size?: number;
  fragmenter?: HighlighterFragmenter;
  highlight_filter?: boolean;
  highlight_query?: Common_QueryDsl.QueryContainer;
  max_analyzer_offset?: number;
  max_fragment_length?: number;
  no_match_size?: number;
  number_of_fragments?: number;
  options?: Record<string, Record<string, any>>;
  order?: HighlighterOrder;
  phrase_limit?: number;
  post_tags?: string[];
  pre_tags?: string[];
  require_field_match?: boolean;
  tags_schema?: HighlighterTagsSchema;
  type?: HighlighterType;
}

export type HighlighterEncoder = 'default' | 'html'

export type HighlighterFragmenter = 'simple' | 'span'

export type HighlighterOrder = 'score'

export type HighlighterTagsSchema = 'styled'

export type HighlighterType = BuiltinHighlighterType | string

export type HighlightField = HighlightBase & {
  analyzer?: Common_Analysis.Analyzer;
  matched_fields?: Common.Fields;
}

export type Hit = {
  _explanation?: Core_Explain.Explanation;
  _id: Common.Id;
  _ignored?: string[];
  _index: Common.IndexName;
  _nested?: NestedIdentity;
  _node?: string;
  _primary_term?: number;
  _routing?: string;
  _score?: undefined | number | string;
  _seq_no?: Common.SequenceNumber;
  _shard?: string;
  _source?: Record<string, any>;
  _type?: Common.Type;
  _version?: Common.VersionNumber;
  fields?: Record<string, any>;
  highlight?: Record<string, string[]>;
  ignored_field_values?: Record<string, string[]>;
  inner_hits?: Record<string, InnerHitsResult>;
  matched_queries?: string[];
  sort?: Common.SortResults;
}

export type HitsMetadata = {
  hits: Hit[];
  max_score?: undefined | number | string;
  total?: TotalHits | number;
}

export type InnerHits = {
  _source?: SourceConfig;
  collapse?: FieldCollapse;
  docvalue_fields?: Common_QueryDsl.FieldAndFormat[];
  explain?: boolean;
  fields?: Common.Fields;
  from?: number;
  highlight?: Highlight;
  ignore_unmapped?: boolean;
  name?: Common.Name;
  script_fields?: Record<string, Common.ScriptField>;
  seq_no_primary_term?: boolean;
  size?: number;
  sort?: Common.Sort;
  stored_fields?: Common.Fields;
  track_scores?: boolean;
  version?: boolean;
}

export type InnerHitsResult = {
  hits: HitsMetadata;
}

export type LaplaceSmoothingModel = {
  alpha: number;
}

export type LinearInterpolationSmoothingModel = {
  bigram_lambda: number;
  trigram_lambda: number;
  unigram_lambda: number;
}

export type NestedIdentity = {
  _nested?: NestedIdentity;
  field: Common.Field;
  offset: number;
}

export type PhraseSuggest = SuggestBase & {
  options: PhraseSuggestOption | PhraseSuggestOption[];
}

export type PhraseSuggestCollate = {
  params?: Record<string, any>;
  prune?: boolean;
  query: PhraseSuggestCollateQuery;
}

export type PhraseSuggestCollateQuery = {
  id?: string;
  source?: string;
}

export type PhraseSuggester = SuggesterBase & {
  collate?: PhraseSuggestCollate;
  confidence?: number;
  direct_generator?: DirectGenerator[];
  force_unigrams?: boolean;
  gram_size?: number;
  highlight?: PhraseSuggestHighlight;
  max_errors?: number;
  real_word_error_likelihood?: number;
  separator?: string;
  shard_size?: number;
  smoothing?: SmoothingModel;
  text?: string;
  token_limit?: number;
}

export type PhraseSuggestHighlight = {
  post_tag: string;
  pre_tag: string;
}

export type PhraseSuggestOption = {
  collate_match?: boolean;
  highlighted?: string;
  score: number;
  text: string;
}

export type PointInTimeReference = {
  id: Common.Id;
  keep_alive?: Common.Duration;
}

export type Profile = {
  shards: ShardProfile[];
}

export type QueryBreakdown = {
  advance: number;
  advance_count: number;
  build_scorer: number;
  build_scorer_count: number;
  compute_max_score: number;
  compute_max_score_count: number;
  create_weight: number;
  create_weight_count: number;
  match: number;
  match_count: number;
  next_doc: number;
  next_doc_count: number;
  score: number;
  score_count: number;
  set_min_competitive_score: number;
  set_min_competitive_score_count: number;
  shallow_advance: number;
  shallow_advance_count: number;
}

export type QueryProfile = {
  breakdown: QueryBreakdown;
  children?: QueryProfile[];
  description: string;
  time_in_nanos: Common.DurationValueUnitNanos;
  type: string;
}

export type Rescore = {
  query: RescoreQuery;
  window_size?: number;
}

export type RescoreQuery = {
  query_weight?: number;
  rescore_query: Common_QueryDsl.QueryContainer;
  rescore_query_weight?: number;
  score_mode?: ScoreMode;
}

export type ResponseBody = {
  _clusters?: Common.ClusterStatistics;
  _scroll_id?: Common.ScrollId;
  _shards: Common.ShardStatistics;
  aggregations?: Record<string, Common_Aggregations.Aggregate>;
  fields?: Record<string, Record<string, any>>;
  hits: HitsMetadata;
  max_score?: number;
  num_reduce_phases?: number;
  phase_took?: Common.PhaseTook;
  pit_id?: Common.Id;
  profile?: Profile;
  suggest?: Record<string, Suggest[]>;
  terminated_early?: boolean;
  timed_out: boolean;
  took: number;
}

export type ScoreMode = 'avg' | 'max' | 'min' | 'multiply' | 'total'

export type SearchProfile = {
  collector: Collector[];
  query: QueryProfile[];
  rewrite_time: number;
}

export type ShardProfile = {
  aggregations: AggregationProfile[];
  fetch?: FetchProfile;
  id: string;
  searches: SearchProfile[];
}

export type SmoothingModel = {
  laplace?: LaplaceSmoothingModel;
  linear_interpolation?: LinearInterpolationSmoothingModel;
  stupid_backoff?: StupidBackoffSmoothingModel;
}

export type SourceConfig = boolean | SourceFilter

export type SourceConfigParam = boolean | Common.Fields

export type SourceFilter = Common.Fields | {
  excludes?: Common.Fields;
  includes?: Common.Fields;
}

export type StringDistance = 'damerau_levenshtein' | 'internal' | 'jaro_winkler' | 'levenshtein' | 'ngram'

export type StupidBackoffSmoothingModel = {
  discount: number;
}

export type Suggest = CompletionSuggest | PhraseSuggest | TermSuggest

export type SuggestBase = {
  length: number;
  offset: number;
  text: string;
}

export type Suggester = {
  text?: string;
  [key: string]: any | FieldSuggester;
}

export type SuggesterBase = {
  analyzer?: string;
  field: string;
  size?: number;
}

export type SuggestFuzziness = {
  fuzziness: string;
  min_length: number;
  prefix_length: number;
  transpositions: boolean;
  unicode_aware: boolean;
}

export type SuggestSort = 'frequency' | 'score'

export type TermSuggest = SuggestBase & {
  options: TermSuggestOption | TermSuggestOption[];
}

export type TermSuggester = SuggesterBase & {
  lowercase_terms?: boolean;
  max_edits?: number;
  max_inspections?: number;
  max_term_freq?: number;
  min_doc_freq?: number;
  min_word_length?: number;
  prefix_length?: number;
  shard_size?: number;
  sort?: SuggestSort;
  string_distance?: StringDistance;
  suggest_mode?: Common.SuggestMode;
  text?: string;
}

export type TermSuggestOption = {
  collate_match?: boolean;
  freq?: number;
  highlighted?: string;
  score: number;
  text: string;
}

export type TotalHits = {
  relation: TotalHitsRelation;
  value: number;
}

export type TotalHitsRelation = 'eq' | 'gte'

export type TrackHits = boolean | number

