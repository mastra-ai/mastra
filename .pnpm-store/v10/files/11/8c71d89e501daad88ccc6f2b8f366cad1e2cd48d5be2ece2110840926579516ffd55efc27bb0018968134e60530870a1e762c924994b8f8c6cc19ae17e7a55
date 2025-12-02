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
import * as Common_Analysis from './_common.analysis'
import * as Indices_Common from './indices._common'

export type AggregateMetricDoubleProperty = PropertyBase & {
  default_metric: string;
  metrics: string[];
  type: 'aggregate_metric_double';
}

export type AllField = {
  analyzer: string;
  enabled: boolean;
  omit_norms: boolean;
  search_analyzer: string;
  similarity: string;
  store: boolean;
  store_term_vector_offsets: boolean;
  store_term_vector_payloads: boolean;
  store_term_vector_positions: boolean;
  store_term_vectors: boolean;
}

export type BinaryProperty = DocValuesPropertyBase & {
  type: 'binary';
}

export type BooleanProperty = DocValuesPropertyBase & {
  boost?: number;
  fielddata?: Indices_Common.NumericFielddata;
  index?: boolean;
  null_value?: boolean;
  type: 'boolean';
}

export type ByteNumberProperty = NumberPropertyBase & {
  null_value?: Common.byte;
  type: 'byte';
}

export type CompletionProperty = DocValuesPropertyBase & {
  analyzer?: string;
  contexts?: SuggestContext[];
  max_input_length?: number;
  preserve_position_increments?: boolean;
  preserve_separators?: boolean;
  search_analyzer?: string;
  type: 'completion';
}

export type ConstantKeywordProperty = PropertyBase & {
  type: 'constant_keyword';
  value?: any;
}

export type CorePropertyBase = PropertyBase & {
  copy_to?: Common.Fields;
  similarity?: string;
  store?: boolean;
}

export type DataStreamTimestamp = {
  enabled: boolean;
}

export type DateNanosProperty = DocValuesPropertyBase & {
  boost?: number;
  format?: string;
  ignore_malformed?: boolean;
  index?: boolean;
  null_value?: Common.DateTime;
  precision_step?: number;
  type: 'date_nanos';
}

export type DateProperty = DocValuesPropertyBase & {
  boost?: number;
  fielddata?: Indices_Common.NumericFielddata;
  format?: string;
  ignore_malformed?: boolean;
  index?: boolean;
  locale?: string;
  null_value?: Common.DateTime;
  precision_step?: number;
  type: 'date';
}

export type DateRangeProperty = RangePropertyBase & {
  format?: string;
  type: 'date_range';
}

export type DocValuesPropertyBase = CorePropertyBase & {
  doc_values?: boolean;
}

export type DoubleNumberProperty = NumberPropertyBase & {
  null_value?: number;
  type: 'double';
}

export type DoubleRangeProperty = RangePropertyBase & {
  type: 'double_range';
}

export type DynamicMapping = 'false' | 'strict' | 'strict_allow_templates' | 'true'

export type DynamicTemplate = {
  mapping?: Property;
  match?: string;
  match_mapping_type?: string;
  match_pattern?: MatchType;
  path_match?: string;
  path_unmatch?: string;
  unmatch?: string;
}

export type FieldAliasProperty = PropertyBase & {
  path?: Common.Field;
  type: 'alias';
}

export type FieldMapping = {
  full_name: string;
  mapping: Record<string, Property>;
}

export type FieldNamesField = {
  enabled: boolean;
}

export type FieldType = 'aggregate_metric_double' | 'alias' | 'binary' | 'boolean' | 'byte' | 'completion' | 'constant_keyword' | 'date' | 'date_nanos' | 'date_range' | 'double' | 'double_range' | 'flat_object' | 'float' | 'float_range' | 'geo_point' | 'geo_shape' | 'half_float' | 'histogram' | 'icu_collation_keyword' | 'integer' | 'integer_range' | 'ip' | 'ip_range' | 'join' | 'keyword' | 'knn_vector' | 'long' | 'long_range' | 'match_only_text' | 'murmur3' | 'nested' | 'object' | 'percolator' | 'rank_feature' | 'rank_features' | 'scaled_float' | 'search_as_you_type' | 'short' | 'text' | 'token_count' | 'unsigned_long' | 'version' | 'wildcard' | 'xy_point' | 'xy_shape'

export type FlatObjectProperty = PropertyBase & {
  aggregatable?: boolean;
  searchable?: boolean;
  type: 'flat_object';
}

export type FloatNumberProperty = NumberPropertyBase & {
  null_value?: number;
  type: 'float';
}

export type FloatRangeProperty = RangePropertyBase & {
  type: 'float_range';
}

export type GeoOrientation = 'left' | 'LEFT' | 'clockwise' | 'cw' | 'right' | 'RIGHT' | 'counterclockwise' | 'ccw'

export type GeoPointProperty = DocValuesPropertyBase & {
  ignore_malformed?: boolean;
  ignore_z_value?: boolean;
  null_value?: Common.GeoLocation;
  type: 'geo_point';
}

export type GeoShapeProperty = DocValuesPropertyBase & {
  coerce?: boolean;
  distance_error_pct?: number;
  ignore_malformed?: boolean;
  ignore_z_value?: boolean;
  orientation?: GeoOrientation;
  strategy?: GeoStrategy;
  type: 'geo_shape';
}

export type GeoStrategy = 'recursive' | 'term'

export type HalfFloatNumberProperty = NumberPropertyBase & {
  null_value?: number;
  type: 'half_float';
}

export type HistogramProperty = PropertyBase & {
  ignore_malformed?: boolean;
  type: 'histogram';
}

export type IcuCollationKeywordProperty = DocValuesPropertyBase & {
  alternate?: Common_Analysis.IcuCollationAlternate;
  case_first?: Common_Analysis.IcuCollationCaseFirst;
  case_level?: boolean;
  country?: string;
  decomposition?: Common_Analysis.IcuCollationDecomposition;
  hiragana_quaternary_mode?: boolean;
  index?: boolean;
  language?: string;
  null_value?: string;
  numeric?: boolean;
  strength?: Common_Analysis.IcuCollationStrength;
  type: 'icu_collation_keyword';
  variable_top?: string;
  variant?: string;
}

export type IndexField = {
  enabled: boolean;
}

export type IndexOptions = 'docs' | 'freqs' | 'offsets' | 'positions'

export type IntegerNumberProperty = NumberPropertyBase & {
  null_value?: number;
  type: 'integer';
}

export type IntegerRangeProperty = RangePropertyBase & {
  type: 'integer_range';
}

export type IpProperty = DocValuesPropertyBase & {
  boost?: number;
  ignore_malformed?: boolean;
  index?: boolean;
  null_value?: string;
  type: 'ip';
}

export type IpRangeProperty = RangePropertyBase & {
  type: 'ip_range';
}

export type JoinProperty = PropertyBase & {
  eager_global_ordinals?: boolean;
  relations?: Record<string, Common.RelationName | Common.RelationName[]>;
  type: 'join';
}

export type KeywordProperty = DocValuesPropertyBase & {
  boost?: number;
  eager_global_ordinals?: boolean;
  index?: boolean;
  index_options?: IndexOptions;
  normalizer?: string;
  norms?: boolean;
  null_value?: string;
  split_queries_on_whitespace?: boolean;
  type: 'keyword';
}

export type KnnVectorMethod = {
  engine?: string;
  name: string;
  parameters?: {
};
  space_type?: string;
}

export type KnnVectorProperty = DocValuesPropertyBase & {
  compression_level?: string;
  data_type?: string;
  dimension: number;
  method?: KnnVectorMethod;
  mode?: string;
  model_id?: string;
  space_type?: string;
  type: 'knn_vector';
}

export type LongNumberProperty = NumberPropertyBase & {
  null_value?: number;
  type: 'long';
}

export type LongRangeProperty = RangePropertyBase & {
  type: 'long_range';
}

export type MatchOnlyTextProperty = {
  copy_to?: Common.Fields;
  fields?: Record<string, Property>;
  meta?: Record<string, string>;
  type: 'match_only_text';
}

export type MatchType = 'regex' | 'simple'

export type Murmur3HashProperty = DocValuesPropertyBase & {
  type: 'murmur3';
}

export type NestedProperty = CorePropertyBase & {
  enabled?: boolean;
  include_in_parent?: boolean;
  include_in_root?: boolean;
  type: 'nested';
}

export type NumberPropertyBase = DocValuesPropertyBase & {
  boost?: number;
  coerce?: boolean;
  ignore_malformed?: boolean;
  index?: boolean;
}

export type ObjectProperty = CorePropertyBase & {
  enabled?: boolean;
  type?: 'object';
}

export type PercolatorProperty = PropertyBase & {
  type: 'percolator';
}

export type Property = BinaryProperty | BooleanProperty | JoinProperty | KeywordProperty | MatchOnlyTextProperty | PercolatorProperty | RankFeatureProperty | RankFeaturesProperty | SearchAsYouTypeProperty | TextProperty | VersionProperty | WildcardProperty | DateNanosProperty | DateProperty | AggregateMetricDoubleProperty | FlatObjectProperty | NestedProperty | ObjectProperty | CompletionProperty | ConstantKeywordProperty | FieldAliasProperty | HistogramProperty | IpProperty | Murmur3HashProperty | TokenCountProperty | GeoPointProperty | GeoShapeProperty | XyPointProperty | XyShapeProperty | ByteNumberProperty | DoubleNumberProperty | FloatNumberProperty | HalfFloatNumberProperty | IntegerNumberProperty | LongNumberProperty | ScaledFloatNumberProperty | ShortNumberProperty | UnsignedLongNumberProperty | DateRangeProperty | DoubleRangeProperty | FloatRangeProperty | IntegerRangeProperty | IpRangeProperty | LongRangeProperty | KnnVectorProperty | IcuCollationKeywordProperty

export type PropertyBase = {
  dynamic?: DynamicMapping;
  fields?: Record<string, Property>;
  ignore_above?: number;
  meta?: Record<string, string>;
  properties?: Record<string, Property>;
}

export type RangePropertyBase = DocValuesPropertyBase & {
  boost?: number;
  coerce?: boolean;
  index?: boolean;
}

export type RankFeatureProperty = PropertyBase & {
  positive_score_impact?: boolean;
  type: 'rank_feature';
}

export type RankFeaturesProperty = PropertyBase & {
  type: 'rank_features';
}

export type RoutingField = {
  required: boolean;
}

export type ScaledFloatNumberProperty = NumberPropertyBase & {
  null_value?: number;
  scaling_factor?: number;
  type: 'scaled_float';
}

export type SearchAsYouTypeProperty = CorePropertyBase & {
  analyzer?: string;
  index?: boolean;
  index_options?: IndexOptions;
  max_shingle_size?: number;
  norms?: boolean;
  search_analyzer?: string;
  search_quote_analyzer?: string;
  term_vector?: TermVectorOption;
  type: 'search_as_you_type';
}

export type ShortNumberProperty = NumberPropertyBase & {
  null_value?: Common.short;
  type: 'short';
}

export type SizeField = {
  enabled: boolean;
}

export type SourceField = {
  compress?: boolean;
  compress_threshold?: string;
  enabled?: boolean;
  excludes?: string[];
  includes?: string[];
}

export type SuggestContext = {
  name: Common.Name;
  path?: Common.Field;
  precision?: number | string;
  type: string;
}

export type TermVectorOption = 'no' | 'with_offsets' | 'with_positions' | 'with_positions_offsets' | 'with_positions_offsets_payloads' | 'with_positions_payloads' | 'yes'

export type TextIndexPrefixes = {
  max_chars: number;
  min_chars: number;
}

export type TextProperty = CorePropertyBase & {
  analyzer?: string;
  boost?: number;
  eager_global_ordinals?: boolean;
  fielddata?: boolean;
  fielddata_frequency_filter?: Indices_Common.FielddataFrequencyFilter;
  index?: boolean;
  index_options?: IndexOptions;
  index_phrases?: boolean;
  index_prefixes?: TextIndexPrefixes;
  norms?: boolean;
  position_increment_gap?: number;
  search_analyzer?: string;
  search_quote_analyzer?: string;
  term_vector?: TermVectorOption;
  type: 'text';
}

export type TokenCountProperty = DocValuesPropertyBase & {
  analyzer?: string;
  boost?: number;
  enable_position_increments?: boolean;
  index?: boolean;
  null_value?: number;
  type: 'token_count';
}

export type TypeMapping = {
  _data_stream_timestamp?: DataStreamTimestamp;
  _field_names?: FieldNamesField;
  _meta?: Common.Metadata;
  _routing?: RoutingField;
  _size?: SizeField;
  _source?: SourceField;
  all_field?: AllField;
  date_detection?: boolean;
  dynamic?: DynamicMapping;
  dynamic_date_formats?: string[];
  dynamic_templates?: Record<string, DynamicTemplate>[];
  enabled?: boolean;
  index_field?: IndexField;
  numeric_detection?: boolean;
  properties?: Record<string, Property>;
}

export type UnsignedLongNumberProperty = NumberPropertyBase & {
  null_value?: Common.ulong;
  type: 'unsigned_long';
}

export type VersionProperty = DocValuesPropertyBase & {
  type: 'version';
}

export type WildcardProperty = DocValuesPropertyBase & {
  normalizer?: string;
  null_value?: string;
  type: 'wildcard';
}

export type XyPointProperty = DocValuesPropertyBase & {
  ignore_malformed?: boolean;
  ignore_z_value?: boolean;
  null_value?: Common.XyLocation;
  type: 'xy_point';
}

export type XyShapeProperty = DocValuesPropertyBase & {
  coerce?: boolean;
  ignore_malformed?: boolean;
  ignore_z_value?: boolean;
  orientation?: GeoOrientation;
  type: 'xy_shape';
}

