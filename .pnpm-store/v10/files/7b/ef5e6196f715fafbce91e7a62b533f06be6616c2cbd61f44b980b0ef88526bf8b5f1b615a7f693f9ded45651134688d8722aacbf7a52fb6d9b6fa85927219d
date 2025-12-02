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
import * as Common_Mapping from './_common.mapping'
import * as Common_QueryDsl from './_common.query_dsl'

export type Alias = {
  filter?: Common_QueryDsl.QueryContainer;
  index_routing?: Common.Routing;
  is_hidden?: boolean;
  is_write_index?: boolean;
  routing?: Common.Routing;
  search_routing?: Common.Routing;
}

export type AliasDefinition = {
  filter?: Common_QueryDsl.QueryContainer;
  index_routing?: string;
  is_hidden?: boolean;
  is_write_index?: boolean;
  routing?: string;
  search_routing?: string;
}

export type DataStream = {
  _meta?: Common.Metadata;
  allow_custom_routing?: boolean;
  generation: number;
  hidden?: boolean;
  ilm_policy?: Common.Name;
  indices: DataStreamIndex[];
  name: Common.DataStreamName;
  next_generation_managed_by?: ManagedBy;
  prefer_ilm?: boolean;
  replicated?: boolean;
  status: Common.HealthStatus;
  system?: boolean;
  template: Common.Name;
  timestamp_field: DataStreamTimestampField;
}

export type DataStreamIndex = {
  ilm_policy?: Common.Name;
  index_name: Common.IndexName;
  index_uuid: Common.Uuid;
  managed_by?: ManagedBy;
  prefer_ilm?: boolean;
}

export type DataStreamStats = {
  backing_indices: number;
  data_stream: Common.Name;
  maximum_timestamp: Common.EpochTimeUnitMillis;
  store_size?: Common.HumanReadableByteCount;
  store_size_bytes: Common.ByteCount;
}

export type DataStreamTimestampField = {
  name: Common.Field;
}

export type FielddataFrequencyFilter = {
  max: number;
  min: number;
  min_segment_size: number;
}

export type IndexCheckOnStartup = 'checksum' | 'false' | 'true'

export type IndexError = {
  error?: IndexErrorCause;
  status?: number;
}

export type IndexErrorCause = {
  index?: Common.IndexName;
  index_uuid?: Common.Uuid;
  reason?: string;
  'resource.id'?: Common.IndexName;
  'resource.type'?: Common.ResourceType;
  root_cause?: IndexErrorCause[];
  type: string;
  [key: string]: any | Record<string, any>;
}

export type IndexGetUpgradeStatus = {
  indices?: Record<string, UpgradeStatus>;
  size_in_bytes?: Common.ByteCount;
  size_to_upgrade_ancient_in_bytes?: Common.ByteCount;
  size_to_upgrade_in_bytes?: Common.ByteCount;
}

export type IndexingPressure = {
  memory: IndexingPressureMemory;
}

export type IndexingPressureMemory = {
  limit?: string | number;
}

export type IndexingSlowlog = {
  level?: string;
  reformat?: Common.StringifiedBoolean;
  source?: Common.StringifiedInteger;
  threshold?: IndexingSlowlogThresholds;
}

export type IndexingSlowlogThresholds = {
  index?: SlowlogThresholdLevels;
}

export type IndexRouting = {
  allocation?: IndexRoutingAllocation;
  rebalance?: IndexRoutingRebalance;
}

export type IndexRoutingAllocation = {
  disk?: IndexRoutingAllocationDisk;
  enable?: IndexRoutingAllocationOptions;
  include?: IndexRoutingAllocationInclude;
  initial_recovery?: IndexRoutingAllocationInitialRecovery;
  total_primary_shards_per_node?: Common.StringifiedInteger;
  total_shards_per_node?: Common.StringifiedInteger;
}

export type IndexRoutingAllocationDisk = {
  threshold_enabled?: Common.StringifiedBoolean;
}

export type IndexRoutingAllocationInclude = {
  _id?: Common.Id;
  _tier_preference?: string;
}

export type IndexRoutingAllocationInitialRecovery = {
  _id?: Common.Id;
}

export type IndexRoutingAllocationOptions = 'all' | 'new_primaries' | 'none' | 'primaries'

export type IndexRoutingRebalance = {
  enable: IndexRoutingRebalanceOptions;
}

export type IndexRoutingRebalanceOptions = 'all' | 'none' | 'primaries' | 'replicas'

export type IndexSegmentSort = {
  field?: Common.Fields;
  missing?: SegmentSortMissing | SegmentSortMissing[];
  mode?: SegmentSortMode | SegmentSortMode[];
  order?: SegmentSortOrder | SegmentSortOrder[];
}

export type IndexSettingBlocks = {
  metadata?: Common.StringifiedBoolean;
  read?: Common.StringifiedBoolean;
  read_only?: Common.StringifiedBoolean;
  read_only_allow_delete?: Common.StringifiedBoolean;
  write?: Common.StringifiedBoolean;
}

export type IndexSettings = {
  analysis?: IndexSettingsAnalysis;
  analyze?: IndexSettingsAnalyze;
  'analyze.max_token_count'?: Common.StringifiedInteger;
  auto_expand_replicas?: string;
  blocks?: IndexSettingBlocks;
  'blocks.metadata'?: Common.StringifiedBoolean;
  'blocks.read'?: Common.StringifiedBoolean;
  'blocks.read_only'?: Common.StringifiedBoolean;
  'blocks.read_only_allow_delete'?: Common.StringifiedBoolean;
  'blocks.write'?: Common.StringifiedBoolean;
  check_on_startup?: IndexCheckOnStartup;
  codec?: string;
  'composite_index.star_tree'?: IndexSettingsStarTree;
  creation_date?: Common.StringifiedEpochTimeUnitMillis;
  creation_date_string?: Common.DateTime;
  default_pipeline?: Common.PipelineName;
  final_pipeline?: Common.PipelineName;
  format?: string | number;
  gc_deletes?: Common.Duration;
  hidden?: Common.StringifiedBoolean;
  highlight?: IndexSettingsHighlight;
  'highlight.max_analyzed_offset'?: Common.StringifiedInteger;
  index?: IndexSettings;
  indexing?: IndexSettingsIndexing;
  indexing_pressure?: IndexingPressure;
  knn?: Common.StringifiedBoolean;
  'knn.algo_param.ef_search'?: Common.StringifiedInteger;
  lifecycle?: IndexSettingsLifecycle;
  'lifecycle.name'?: Common.Name;
  load_fixed_bitset_filters_eagerly?: Common.StringifiedBoolean;
  mapping?: IndexSettingsMapping;
  max_docvalue_fields_search?: Common.StringifiedInteger;
  max_inner_result_window?: Common.StringifiedInteger;
  max_ngram_diff?: Common.StringifiedInteger;
  max_refresh_listeners?: Common.StringifiedInteger;
  max_regex_length?: Common.StringifiedInteger;
  max_rescore_window?: Common.StringifiedInteger;
  max_result_window?: Common.StringifiedInteger;
  max_script_fields?: Common.StringifiedInteger;
  max_shingle_diff?: Common.StringifiedInteger;
  max_slices_per_scroll?: Common.StringifiedInteger;
  max_terms_count?: Common.StringifiedInteger;
  merge?: IndexSettingsMerge;
  'merge.scheduler.max_thread_count'?: Common.StringifiedInteger;
  mode?: string;
  number_of_replicas?: Common.StringifiedInteger;
  number_of_routing_shards?: Common.StringifiedInteger;
  number_of_shards?: Common.StringifiedInteger;
  priority?: number | string;
  provided_name?: Common.Name;
  queries?: IndexSettingsQueries;
  query_string?: IndexSettingsQueryString;
  'query_string.lenient'?: Common.StringifiedBoolean;
  refresh_interval?: Common.Duration;
  routing?: IndexRouting;
  routing_partition_size?: Common.StringifiedInteger;
  routing_path?: Common.StringOrStringArray;
  search?: IndexSettingsSearch;
  'search.idle.after'?: Common.Duration;
  settings?: IndexSettings;
  similarity?: IndexSettingsSimilarity;
  soft_deletes?: SoftDeletes;
  'soft_deletes.retention_lease.period'?: Common.Duration;
  sort?: IndexSegmentSort;
  store?: IndexSettingsStore;
  top_metrics_max_size?: Common.StringifiedInteger;
  translog?: Translog;
  'translog.durability'?: TranslogDurability;
  'translog.flush_threshold_size'?: Common.HumanReadableByteCount;
  uuid?: Common.Uuid;
  verified_before_close?: Common.StringifiedBoolean;
  version?: IndexVersioning;
  [key: string]: any | Record<string, any>;
}

export type IndexSettingsAnalysis = {
  analyzer?: Record<string, Common_Analysis.Analyzer>;
  char_filter?: Record<string, Common_Analysis.CharFilter>;
  filter?: Record<string, Common_Analysis.TokenFilter>;
  normalizer?: Record<string, Common_Analysis.Normalizer>;
  tokenizer?: Record<string, Common_Analysis.Tokenizer>;
}

export type IndexSettingsAnalyze = {
  max_token_count?: Common.StringifiedInteger;
}

export type IndexSettingsHighlight = {
  max_analyzed_offset?: Common.StringifiedInteger;
}

export type IndexSettingsIndexing = {
  slowlog?: IndexingSlowlog;
}

export type IndexSettingsLifecycle = {
  indexing_complete?: Common.StringifiedBoolean;
  name: Common.Name;
  origination_date?: Common.StringifiedEpochTimeUnitMillis;
  parse_origination_date?: boolean;
  rollover_alias?: string;
  step?: IndexSettingsLifecycleStep;
}

export type IndexSettingsLifecycleStep = {
  wait_time_threshold?: Common.Duration;
}

export type IndexSettingsMapping = {
  coerce?: Common.StringifiedBoolean;
  depth?: IndexSettingsMappingLimitDepth;
  dimension_fields?: IndexSettingsMappingLimitDimensionFields;
  field_name_length?: IndexSettingsMappingLimitFieldNameLength;
  ignore_malformed?: Common.StringifiedBoolean;
  nested_fields?: IndexSettingsMappingLimitNestedFields;
  nested_objects?: IndexSettingsMappingLimitNestedObjects;
  total_fields?: IndexSettingsMappingLimitTotalFields;
}

export type IndexSettingsMappingLimitDepth = {
  limit?: Common.StringifiedLong;
}

export type IndexSettingsMappingLimitDimensionFields = {
  limit?: Common.StringifiedLong;
}

export type IndexSettingsMappingLimitFieldNameLength = {
  limit?: Common.StringifiedLong;
}

export type IndexSettingsMappingLimitNestedFields = {
  limit?: Common.StringifiedLong;
}

export type IndexSettingsMappingLimitNestedObjects = {
  limit?: Common.StringifiedLong;
}

export type IndexSettingsMappingLimitTotalFields = {
  limit?: Common.StringifiedLong;
}

export type IndexSettingsMerge = {
  log_byte_size_policy?: IndexSettingsMergeLogByteSizePolicy;
  policy?: IndexSettingsMergePolicy;
  'policy.deletes_pct_allowed'?: Common.StringifiedDouble;
  'policy.expunge_deletes_allowed'?: Common.StringifiedDouble;
  'policy.floor_segment'?: Common.HumanReadableByteCount;
  'policy.max_merge_at_once'?: Common.StringifiedInteger;
  'policy.max_merged_segment'?: Common.HumanReadableByteCount;
  'policy.reclaim_deletes_weight'?: Common.StringifiedDouble;
  'policy.segments_per_tier'?: Common.StringifiedDouble;
  scheduler?: IndexSettingsMergeScheduler;
}

export type IndexSettingsMergeLogByteSizePolicy = {
  max_merge_segment?: Common.HumanReadableByteCount;
  max_merge_segment_forced_merge?: Common.HumanReadableByteCount;
  max_merged_docs?: Common.StringifiedInteger;
  merge_factor?: Common.StringifiedInteger;
  min_merge?: Common.HumanReadableByteCount;
  no_cfs_ratio?: Common.StringifiedDouble;
}

export type IndexSettingsMergePolicy = IndexSettingsMergePolicyName | IndexSettingsMergeTieredPolicy

export type IndexSettingsMergePolicyName = 'default' | 'log_byte_size' | 'tiered'

export type IndexSettingsMergeScheduler = {
  auto_throttle?: Common.StringifiedBoolean;
  max_merge_count?: Common.StringifiedInteger;
  max_thread_count?: Common.StringifiedInteger;
}

export type IndexSettingsMergeTieredPolicy = {
  deletes_pct_allowed?: Common.StringifiedDouble;
  expunge_deletes_allowed?: Common.StringifiedDouble;
  floor_segment?: Common.HumanReadableByteCount;
  max_merge_at_once?: Common.StringifiedInteger;
  max_merge_at_once_explicit?: Common.StringifiedInteger;
  max_merged_segment?: Common.HumanReadableByteCount;
  reclaim_deletes_weight?: Common.StringifiedDouble;
  segments_per_tier?: Common.StringifiedDouble;
}

export type IndexSettingsQueries = {
  cache?: IndexSettingsQueriesCache;
}

export type IndexSettingsQueriesCache = {
  enabled: Common.StringifiedBoolean;
}

export type IndexSettingsQueryString = {
  lenient?: Common.StringifiedBoolean;
}

export type IndexSettingsSearch = {
  concurrent?: IndexSettingsSearchConcurrent;
  concurrent_segment_search?: IndexSettingsSearchConcurrentSegmentSearch;
  default_pipeline?: string;
  idle?: SearchIdle;
  slowlog?: SearchSlowlog;
  throttled?: Common.StringifiedBoolean;
}

export type IndexSettingsSearchConcurrent = {
  max_slice_count?: Common.StringifiedInteger;
}

export type IndexSettingsSearchConcurrentSegmentSearch = {
  enabled?: Common.StringifiedBoolean;
  mode?: string;
}

export type IndexSettingsSimilarity = {
  bm25?: IndexSettingsSimilarityBm25;
  dfi?: IndexSettingsSimilarityDfi;
  dfr?: IndexSettingsSimilarityDfr;
  ib?: IndexSettingsSimilarityIb;
  lmd?: IndexSettingsSimilarityLmd;
  lmj?: IndexSettingsSimilarityLmj;
  scripted_tfidf?: IndexSettingsSimilarityScriptedTfidf;
}

export type IndexSettingsSimilarityBm25 = {
  b: number;
  discount_overlaps: boolean;
  k1: number;
  type: 'BM25';
}

export type IndexSettingsSimilarityDfi = {
  independence_measure: Common.DFIIndependenceMeasure;
  type: 'DFI';
}

export type IndexSettingsSimilarityDfr = {
  after_effect: Common.DFRAfterEffect;
  basic_model: Common.DFRBasicModel;
  normalization: Common.TermFrequencyNormalization;
  type: 'DFR';
}

export type IndexSettingsSimilarityIb = {
  distribution: Common.IBDistribution;
  lambda: Common.IBLambda;
  normalization: Common.TermFrequencyNormalization;
  type: 'IB';
}

export type IndexSettingsSimilarityLmd = {
  mu: number;
  type: 'LMDirichlet';
}

export type IndexSettingsSimilarityLmj = {
  lambda: number;
  type: 'LMJelinekMercer';
}

export type IndexSettingsSimilarityScriptedTfidf = {
  script: Common.Script;
  type: 'scripted';
}

export type IndexSettingsStarTree = {
  default?: IndexSettingsStarTreeDefault;
  field?: IndexSettingsStarTreeField;
  max_fields?: Common.StringifiedInteger;
}

export type IndexSettingsStarTreeDefault = {
  max_leaf_docs?: Common.StringifiedInteger;
}

export type IndexSettingsStarTreeField = {
  default?: IndexSettingsStarTreeFieldDefault;
  max_base_metrics?: Common.StringifiedInteger;
  max_date_intervals?: Common.StringifiedInteger;
  max_dimensions?: Common.StringifiedInteger;
}

export type IndexSettingsStarTreeFieldDefault = {
  date_intervals?: string[];
  metrics?: string[];
}

export type IndexSettingsStore = {
  allow_mmap?: Common.StringifiedBoolean;
  fs?: IndexSettingsStoreFs;
  hybrid?: IndexSettingsStoreHybrid;
  preload?: string[];
  stats_refresh_interval?: Common.Duration;
  type: StorageType;
}

export type IndexSettingsStoreFs = {
  fs_lock?: IndexSettingsStoreFsLock;
}

export type IndexSettingsStoreFsLock = 'native' | 'simple'

export type IndexSettingsStoreHybrid = {
  mmap?: IndexSettingsStoreHybridMmap;
  nio?: IndexSettingsStoreHybridNio;
}

export type IndexSettingsStoreHybridMmap = {
  extensions?: string[];
}

export type IndexSettingsStoreHybridNio = {
  extensions?: string[];
}

export type IndexState = {
  aliases?: Record<string, Alias>;
  data_stream?: Common.DataStreamName;
  defaults?: IndexSettings;
  mappings?: Common_Mapping.TypeMapping;
  settings?: IndexSettings;
}

export type IndexTemplate = {
  _meta?: Common.Metadata;
  allow_auto_create?: boolean;
  composed_of?: Common.Name[];
  data_stream?: IndexTemplateDataStreamConfiguration;
  index_patterns: Common.Names;
  priority?: number;
  template?: IndexTemplateSummary;
  version?: Common.VersionNumber;
}

export type IndexTemplateDataStreamConfiguration = {
  allow_custom_routing?: boolean;
  hidden?: boolean;
  timestamp_field?: DataStreamTimestampField;
}

export type IndexTemplateSummary = {
  aliases?: Record<string, Alias>;
  mappings?: Common_Mapping.TypeMapping;
  settings?: IndexSettings;
}

export type IndexVersioning = {
  created?: Common.VersionString;
  created_string?: string;
}

export type ManagedBy = 'Data stream lifecycle' | 'Index Lifecycle Management' | 'Unmanaged'

export type NumericFielddata = {
  format: NumericFielddataFormat;
}

export type NumericFielddataFormat = 'array' | 'disabled'

export type RetentionLease = {
  period: Common.Duration;
}

export type SearchIdle = {
  after?: Common.Duration;
}

export type SearchSlowlog = {
  level?: string;
  reformat?: boolean;
  threshold?: SearchSlowlogThresholds;
}

export type SearchSlowlogThresholds = {
  fetch?: SlowlogThresholdLevels;
  query?: SlowlogThresholdLevels;
}

export type SegmentSortMissing = '_first' | '_last'

export type SegmentSortMode = 'max' | 'min'

export type SegmentSortOrder = 'asc' | 'desc'

export type SlowlogThresholdLevels = {
  debug?: Common.Duration;
  info?: Common.Duration;
  trace?: Common.Duration;
  warn?: Common.Duration;
}

export type SoftDeletes = {
  enabled?: Common.StringifiedBoolean;
  retention?: SoftDeletesRetention;
  retention_lease?: RetentionLease;
}

export type SoftDeletesRetention = {
  operations?: Common.StringifiedLong;
}

export type StorageType = 'fs' | 'hybridfs' | 'mmapfs' | 'niofs' | string

export type TemplateMapping = {
  aliases: Record<string, Alias>;
  index_patterns: Common.Name[];
  mappings: Common_Mapping.TypeMapping;
  order: number;
  settings: Record<string, any>;
  version?: Common.VersionNumber;
}

export type Translog = {
  durability?: TranslogDurability;
  flush_threshold_size?: Common.HumanReadableByteCount;
  generation_threshold_size?: Common.HumanReadableByteCount;
  retention?: TranslogRetention;
  sync_interval?: Common.Duration;
}

export type TranslogDurability = 'ASYNC' | 'REQUEST' | 'async' | 'request'

export type TranslogRetention = {
  age?: Common.Duration;
  size?: Common.HumanReadableByteCount;
}

export type UpgradeStatus = {
  size_in_bytes?: Common.ByteCount;
  size_to_upgrade_ancient_in_bytes?: Common.ByteCount;
  size_to_upgrade_in_bytes?: Common.ByteCount;
}

export type UpgradeVersionStatus = {
  oldest_lucene_segment_version?: Common.VersionString;
  upgrade_version?: Common.VersionString;
}

