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

import * as Cluster_AllocationExplain from './cluster.allocation_explain'
import * as Common_Mapping from './_common.mapping'
import * as Common_QueryDsl from './_common.query_dsl'
import * as Indices_Stats from './indices.stats'

export type AcknowledgedResponseBase = {
  acknowledged: boolean;
}

export type ActionStatusOptions = 'failure' | 'simulated' | 'success' | 'throttled'

export type BaseNode = {
  attributes?: Record<string, string>;
  host?: Host;
  ip?: Ip;
  name: Name;
  roles?: NodeRoles;
  transport_address?: TransportAddress;
}

export type BatchSize = number

export type BuiltinScriptLanguage = 'expression' | 'java' | 'mustache' | 'painless'

export type BulkByScrollFailure = BulkItemResponseFailure | ScrollableHitSourceSearchFailure

export type BulkByScrollResponseBase = BulkByScrollTaskStatus & {
  failures: BulkByScrollFailure[];
  timed_out: boolean;
  took: number;
}

export type BulkByScrollTaskStatus = {
  batches: number;
  canceled?: string;
  created?: number;
  deleted: number;
  noops: number;
  requests_per_second: number;
  retries: Retries;
  slice_id?: number;
  slices?: BulkByScrollTaskStatusOrException[];
  throttled?: Duration;
  throttled_millis: DurationValueUnitMillis;
  throttled_until?: Duration;
  throttled_until_millis: DurationValueUnitMillis;
  total: number;
  updated?: number;
  version_conflicts: number;
}

export type BulkByScrollTaskStatusOrException = BulkByScrollTaskStatus | ErrorCause

export type BulkItemResponseFailure = {
  cause: ErrorCause;
  id?: Id;
  index: IndexName;
  status: number;
}

export type byte = number

export type ByteCount = number

export type ByteUnit = 'b' | 'kb' | 'k' | 'mb' | 'm' | 'gb' | 'g' | 'tb' | 't' | 'pb' | 'p'

export type ClusterDetails = {
  _shards?: ShardStatistics;
  failures?: ShardFailure[];
  indices: string;
  status: ClusterSearchStatus;
  timed_out: boolean;
  took?: DurationValueUnitMillis;
}

export type ClusterSearchStatus = 'failed' | 'partial' | 'running' | 'skipped' | 'successful'

export type ClusterStatistics = {
  details?: Record<string, ClusterDetails>;
  failed: number;
  partial: number;
  running: number;
  skipped: number;
  successful: number;
  total: number;
}

export type CompletionStats = {
  fields?: Record<string, FieldSizeUsage>;
  size?: HumanReadableByteCount;
  size_in_bytes: ByteCount;
}

export type Conflicts = 'abort' | 'proceed'

export type CoordsGeoBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export type DataStreamName = string

export type DataStreamNames = DataStreamName | DataStreamName[]

export type DateFormat = string

export type DateMath = string

export type DateTime = string | EpochTimeUnitMillis

export type DFIIndependenceMeasure = 'chisquared' | 'saturated' | 'standardized'

export type DFRAfterEffect = 'b' | 'l' | 'no'

export type DFRBasicModel = 'be' | 'd' | 'g' | 'if' | 'in' | 'ine' | 'p'

export type Distance = string

export type DistanceUnit = 'cm' | 'ft' | 'in' | 'km' | 'm' | 'mi' | 'mm' | 'nmi' | 'yd'

export type DocStats = {
  count: number;
  deleted?: number;
}

export type DocStatus = {
  '1xx'?: number;
  '2xx'?: number;
  '3xx'?: number;
  '4xx'?: number;
  '5xx'?: number;
}

export type Duration = string

export type DurationLarge = string

export type DurationValueUnitMicros = UnitMicros

export type DurationValueUnitMillis = UnitMillis

export type DurationValueUnitNanos = UnitNanos

export type EmptyObject = Record<string, any>

export type EpochTimeUnitMillis = UnitMillis

export type EpochTimeUnitSeconds = UnitSeconds

export type ErrorCause = {
  caused_by?: ErrorCause;
  reason?: string;
  root_cause?: ErrorCause[];
  stack_trace?: string;
  suppressed?: ErrorCause[];
  type: string;
  [key: string]: any | Record<string, any>;
}

export type ErrorResponseBase = {
  error: ErrorCause;
  status: number;
}

export type ExpandWildcard = 'all' | 'closed' | 'hidden' | 'none' | 'open'

export type ExpandWildcards = ExpandWildcard | ExpandWildcard[]

export type Field = string

export type FielddataStats = {
  evictions?: number;
  fields?: Record<string, FieldMemoryUsage>;
  memory_size?: HumanReadableByteCount;
  memory_size_in_bytes: ByteCount;
}

export type FieldMemoryUsage = {
  memory_size?: HumanReadableByteCount;
  memory_size_in_bytes: ByteCount;
}

export type Fields = Field | Field[]

export type FieldSizeUsage = {
  size?: HumanReadableByteCount;
  size_in_bytes: ByteCount;
}

export type FieldSort = SortOrder | {
  format?: string;
  missing?: FieldValue;
  mode?: SortMode;
  nested?: NestedSortValue;
  numeric_type?: FieldSortNumericType;
  order?: SortOrder;
  unmapped_type?: Common_Mapping.FieldType;
}

export type FieldSortNumericType = 'date' | 'date_nanos' | 'double' | 'long'

export type FieldValue = boolean | undefined | number | string

export type FlushStats = {
  periodic: number;
  total: number;
  total_time?: Duration;
  total_time_in_millis: DurationValueUnitMillis;
}

export type Fuzziness = string | number

export type GeoBounds = CoordsGeoBounds | TopLeftBottomRightGeoBounds | TopRightBottomLeftGeoBounds | WktGeoBounds

export type GeoDistanceSort = {
  distance_type?: GeoDistanceType;
  ignore_unmapped?: boolean;
  mode?: SortMode;
  order?: SortOrder;
  unit?: DistanceUnit;
  [key: string]: any | GeoLocation[];
}

export type GeoDistanceType = 'arc' | 'plane'

export type GeoHash = string

export type GeoHashLocation = {
  geohash: GeoHash;
}

export type GeoHashPrecision = number | string

export type GeoLine = {
  coordinates: number[][];
  type: string;
}

export type GeoLocation = LatLonGeoLocation | GeoHashLocation | number[] | string

export type GeoShapeRelation = 'contains' | 'disjoint' | 'intersects' | 'within'

export type GeoTile = string

export type GeoTilePrecision = number

export type GetStats = {
  current: number;
  exists_time?: Duration;
  exists_time_in_millis: DurationValueUnitMillis;
  exists_total: number;
  getTime?: Duration;
  missing_time?: Duration;
  missing_time_in_millis: DurationValueUnitMillis;
  missing_total: number;
  time?: Duration;
  time_in_millis: DurationValueUnitMillis;
  total: number;
}

export type HealthStatus = 'green' | 'GREEN' | 'yellow' | 'YELLOW' | 'red' | 'RED'

export type Host = string

export type HttpHeaders = Record<string, StringOrStringArray>

export type HumanReadableByteCount = string

export type IBDistribution = 'll' | 'spl'

export type IBLambda = 'df' | 'ttf'

export type Id = string

export type Ids = Id | Id[]

export type IndexAlias = string

export type IndexingStats = {
  delete_current: number;
  delete_time?: Duration;
  delete_time_in_millis: DurationValueUnitMillis;
  delete_total: number;
  doc_status?: DocStatus;
  index_current: number;
  index_failed: number;
  index_time?: Duration;
  index_time_in_millis: DurationValueUnitMillis;
  index_total: number;
  is_throttled: boolean;
  noop_update_total: number;
  throttle_time?: Duration;
  throttle_time_in_millis: DurationValueUnitMillis;
  types?: Record<string, IndexingStats>;
}

export type IndexName = string

export type Indices = IndexName | IndexName[]

export type IndicesResponseBase = AcknowledgedResponseBase & {
  _shards?: ShardStatistics;
}

export type InlineGet = {
  _primary_term?: number;
  _routing?: Routing;
  _seq_no?: SequenceNumber;
  _source?: Record<string, any>;
  fields?: Record<string, Record<string, any>>;
  found: boolean;
}

export type InlineGetDictUserDefined = {
  _primary_term?: number;
  _routing?: Routing;
  _seq_no?: SequenceNumber;
  _source?: Record<string, any>;
  fields?: Record<string, Record<string, any>>;
  found: boolean;
}

export type InlineScript = string | (ScriptBase & {
  lang?: ScriptLanguage;
  options?: Record<string, string>;
  source: string;
})

export type Ip = string

export type LatLonGeoLocation = {
  lat: number;
  lon: number;
}

export type Level = 'cluster' | 'indices' | 'shards'

export type MergesStats = {
  current: number;
  current_docs: number;
  current_size?: HumanReadableByteCount;
  current_size_in_bytes: ByteCount;
  total: number;
  total_auto_throttle?: HumanReadableByteCount;
  total_auto_throttle_in_bytes: ByteCount;
  total_docs: number;
  total_size?: HumanReadableByteCount;
  total_size_in_bytes: ByteCount;
  total_stopped_time?: Duration;
  total_stopped_time_in_millis: DurationValueUnitMillis;
  total_throttled_time?: Duration;
  total_throttled_time_in_millis: DurationValueUnitMillis;
  total_time?: Duration;
  total_time_in_millis: DurationValueUnitMillis;
  unreferenced_file_cleanups_performed?: number;
}

export type Metadata = Record<string, any>

export type MinimumShouldMatch = number | string

export type MultiTermQueryRewrite = 'constant_score' | 'constant_score_boolean' | 'scoring_boolean' | string

export type Name = string

export type Names = Name | Name[]

export type NestedSortValue = {
  filter?: Common_QueryDsl.QueryContainer;
  max_children?: number;
  nested?: NestedSortValue;
  path: Field;
}

export type NodeAttributes = {
  attributes: Record<string, string>;
  ephemeral_id: Id;
  external_id?: string;
  id?: NodeId;
  name: NodeName;
  roles?: NodeRoles;
  transport_address: TransportAddress;
}

export type NodeId = string

export type NodeIds = NodeId | NodeId[]

export type NodeName = string

export type NodeRole = 'client' | 'coordinating_only' | 'data' | 'data_cold' | 'data_content' | 'data_frozen' | 'data_hot' | 'data_warm' | 'ingest' | 'ml' | 'remote_cluster_client' | 'transform' | 'voting_only' | 'master' | 'cluster_manager'

export type NodeRoles = NodeRole[]

export type NodeShard = {
  allocation_id?: Record<string, Id>;
  index: IndexName;
  node?: NodeName;
  primary: boolean;
  recovery_source?: Record<string, Id>;
  relocating_node?: NodeId | undefined;
  shard: number;
  state: Indices_Stats.ShardRoutingState;
  unassigned_info?: Cluster_AllocationExplain.UnassignedInformation;
}

export type NodeStatistics = {
  failed: number;
  failures?: ErrorCause[];
  successful: number;
  total: number;
}

export type OpenSearchVersionInfo = {
  build_date: DateTime;
  build_flavor?: string;
  build_hash: string;
  build_snapshot: boolean;
  build_type: string;
  distribution: string;
  lucene_version: VersionString;
  minimum_index_compatibility_version: VersionString;
  minimum_wire_compatibility_version: VersionString;
  number: string;
}

export type OpType = 'create' | 'index'

export type Password = string

export type PercentageNumber = number

export type PercentageString = string

export type PhaseTook = {
  can_match: uint;
  dfs_pre_query: uint;
  dfs_query: uint;
  expand: uint;
  fetch: uint;
  query: uint;
}

export type PipelineName = string

export type PluginStats = {
  classname: string;
  custom_foldername?: undefined | string;
  description: string;
  extended_plugins: string[];
  has_native_controller: boolean;
  java_version: VersionString;
  licensed?: boolean;
  name: Name;
  opensearch_version: VersionString;
  optional_extended_plugins?: string[];
  version: VersionString;
}

export type QueryCacheStats = {
  cache_count: number;
  cache_size: number;
  evictions: number;
  hit_count: number;
  memory_size?: HumanReadableByteCount;
  memory_size_in_bytes: ByteCount;
  miss_count: number;
  total_count: number;
}

export type RankBase = Record<string, any>

export type RankContainer = {
  rrf?: RrfRank;
}

export type RecoveryStats = {
  current_as_source: number;
  current_as_target: number;
  throttle_time?: Duration;
  throttle_time_in_millis: DurationValueUnitMillis;
}

export type Refresh = boolean | 'false' | 'true' | 'wait_for'

export type RefreshStats = {
  external_total: number;
  external_total_time?: Duration;
  external_total_time_in_millis: DurationValueUnitMillis;
  listeners: number;
  total: number;
  total_time?: Duration;
  total_time_in_millis: DurationValueUnitMillis;
}

export type RelationName = string

export type RemoteStoreDownloadStats = {
  total_download_size: RemoteStoreUploadDownloadStats;
  total_time_spent?: Duration;
  total_time_spent_in_millis: DurationValueUnitMillis;
}

export type RemoteStoreStats = {
  download: RemoteStoreDownloadStats;
  upload: RemoteStoreUploadStats;
}

export type RemoteStoreTranslogStats = {
  upload: RemoteStoreTranslogUploadStats;
}

export type RemoteStoreTranslogUploadStats = {
  total_upload_size: RemoteStoreTranslogUploadTotalUploadSizeStats;
  total_uploads: RemoteStoreTranslogUploadTotalUploadsStats;
}

export type RemoteStoreTranslogUploadTotalUploadSizeStats = {
  failed?: HumanReadableByteCount;
  failed_bytes: ByteCount;
  started?: HumanReadableByteCount;
  started_bytes: ByteCount;
  succeeded?: HumanReadableByteCount;
  succeeded_bytes: ByteCount;
}

export type RemoteStoreTranslogUploadTotalUploadsStats = {
  failed: number;
  started: number;
  succeeded: number;
}

export type RemoteStoreUploadDownloadStats = {
  failed?: HumanReadableByteCount;
  failed_bytes: ByteCount;
  started?: HumanReadableByteCount;
  started_bytes: ByteCount;
  succeeded?: HumanReadableByteCount;
  succeeded_bytes: ByteCount;
}

export type RemoteStoreUploadPressureStats = {
  total_rejections: number;
}

export type RemoteStoreUploadRefreshSizeLagStats = {
  max?: HumanReadableByteCount;
  max_bytes: ByteCount;
  total?: HumanReadableByteCount;
  total_bytes: ByteCount;
}

export type RemoteStoreUploadStats = {
  max_refresh_time_lag?: Duration;
  max_refresh_time_lag_in_millis: DurationValueUnitMillis;
  pressure?: RemoteStoreUploadPressureStats;
  refresh_size_lag: RemoteStoreUploadRefreshSizeLagStats;
  total_time_spent?: Duration;
  total_time_spent_in_millis: DurationValueUnitMillis;
  total_upload_size: RemoteStoreUploadDownloadStats;
}

export type RequestCacheStats = {
  evictions: number;
  hit_count: number;
  memory_size?: HumanReadableByteCount;
  memory_size_in_bytes: ByteCount;
  miss_count: number;
}

export type RequestStats = {
  current?: number;
  time?: Duration;
  time_in_millis?: DurationValueUnitMillis;
  total?: number;
}

export type ResourceStat = {
  cpu_time_in_nanos: DurationValueUnitNanos;
  memory_in_bytes: ByteCount;
}

export type ResourceStats = {
  average: ResourceStat;
  max: ResourceStat;
  min: ResourceStat;
  thread_info: ThreadInfo;
  total: ResourceStat;
}

export type ResourceType = 'index_or_alias'

export type Result = 'created' | 'deleted' | 'noop' | 'not_found' | 'updated'

export type Retries = {
  bulk: number;
  search: number;
}

export type Routing = string

export type RoutingInQueryString = StringOrStringArray

export type RrfRank = RankBase & {
  rank_constant?: number;
  window_size?: number;
}

export type ScoreSort = {
  order?: SortOrder;
}

export type Script = InlineScript | StoredScriptId

export type ScriptBase = {
  params?: Record<string, any>;
}

export type ScriptField = {
  ignore_failure?: boolean;
  script: Script;
}

export type ScriptLanguage = BuiltinScriptLanguage | string

export type ScriptSort = {
  mode?: SortMode;
  nested?: NestedSortValue;
  order?: SortOrder;
  script: Script;
  type?: ScriptSortType;
}

export type ScriptSortType = 'number' | 'string' | 'version'

export type ScrollableHitSourceSearchFailure = {
  index?: IndexName;
  node?: string;
  reason: ErrorCause;
  shard?: number;
  status: number;
}

export type ScrollId = string

export type ScrollIds = ScrollId | ScrollId[]

export type SearchStats = {
  concurrent_avg_slice_count?: number;
  concurrent_query_current?: number;
  concurrent_query_time?: Duration;
  concurrent_query_time_in_millis?: DurationValueUnitMillis;
  concurrent_query_total?: number;
  fetch_current: number;
  fetch_time?: Duration;
  fetch_time_in_millis: DurationValueUnitMillis;
  fetch_total: number;
  groups?: Record<string, SearchStats>;
  open_contexts?: number;
  point_in_time_current?: number;
  point_in_time_time?: Duration;
  point_in_time_time_in_millis?: DurationValueUnitMillis;
  point_in_time_total?: number;
  query_current: number;
  query_time?: Duration;
  query_time_in_millis: DurationValueUnitMillis;
  query_total: number;
  request?: Record<string, RequestStats>;
  scroll_current: number;
  scroll_time?: Duration;
  scroll_time_in_millis: DurationValueUnitMillis;
  scroll_total: number;
  search_idle_reactivate_count_total?: number;
  suggest_current: number;
  suggest_time?: Duration;
  suggest_time_in_millis: DurationValueUnitMillis;
  suggest_total: number;
}

export type SearchType = 'dfs_query_then_fetch' | 'query_then_fetch'

export type SegmentReplicationStats = {
  max_bytes_behind: HumanReadableByteCount;
  max_replication_lag: Duration;
  total_bytes_behind: HumanReadableByteCount;
} | {
  max_bytes_behind: ByteCount;
  max_replication_lag: DurationValueUnitMillis;
  total_bytes_behind: ByteCount;
}

export type SegmentsStats = {
  count: number;
  doc_values_memory?: HumanReadableByteCount;
  doc_values_memory_in_bytes: ByteCount;
  file_sizes: Record<string, Indices_Stats.ShardFileSizeInfo>;
  fixed_bit_set?: HumanReadableByteCount;
  fixed_bit_set_memory_in_bytes: ByteCount;
  index_writer_max_memory_in_bytes?: ByteCount;
  index_writer_memory?: HumanReadableByteCount;
  index_writer_memory_in_bytes: ByteCount;
  max_unsafe_auto_id_timestamp: EpochTimeUnitMillis;
  memory?: HumanReadableByteCount;
  memory_in_bytes: ByteCount;
  norms_memory?: HumanReadableByteCount;
  norms_memory_in_bytes: ByteCount;
  points_memory?: HumanReadableByteCount;
  points_memory_in_bytes: ByteCount;
  remote_store?: RemoteStoreStats;
  segment_replication?: SegmentReplicationStats;
  stored_fields_memory?: HumanReadableByteCount;
  stored_fields_memory_in_bytes: ByteCount;
  term_vectors_memory?: HumanReadableByteCount;
  term_vectors_memory_in_bytes: ByteCount;
  terms_memory?: HumanReadableByteCount;
  terms_memory_in_bytes: ByteCount;
  version_map_memory?: HumanReadableByteCount;
  version_map_memory_in_bytes: ByteCount;
}

export type SequenceNumber = number

export type ShardFailure = {
  index?: IndexName;
  node?: string;
  reason: ErrorCause;
  shard: number;
  status?: string;
}

export type ShardsOperationResponseBase = {
  _shards: ShardStatistics;
}

export type ShardStatistics = {
  failed: uint;
  failures?: ShardFailure[];
  skipped?: uint;
  successful: uint;
  total: uint;
}

export type short = number

export type SlicedScroll = {
  field?: Field;
  id: number;
  max: number;
}

export type Slices = number | SlicesCalculation

export type SlicesCalculation = 'auto'

export type Sort = SortOptions | SortOptions[]

export type SortMode = 'avg' | 'max' | 'median' | 'min' | 'sum'

export type SortOptions = '_score' | '_doc' | string | {
  _doc?: ScoreSort;
  _geo_distance?: GeoDistanceSort;
  _score?: ScoreSort;
  _script?: ScriptSort;
} | Record<string, FieldSort>

export type SortOrder = 'asc' | 'desc'

export type SortResults = FieldValue[]

export type StoredScript = {
  lang: ScriptLanguage;
  options?: Record<string, string>;
  source: string;
}

export type StoredScriptId = ScriptBase & {
  id: Id;
}

export type StoreStats = {
  reserved?: HumanReadableByteCount;
  reserved_in_bytes: ByteCount;
  size?: HumanReadableByteCount;
  size_in_bytes: ByteCount;
}

export type StringifiedBoolean = boolean | string

export type StringifiedDouble = number | string

export type StringifiedEpochTimeUnitMillis = EpochTimeUnitMillis | string

export type StringifiedEpochTimeUnitSeconds = EpochTimeUnitSeconds | string

export type StringifiedInteger = number | string

export type StringifiedLong = number | string

export type StringifiedVersionNumber = VersionNumber | string

export type StringOrStringArray = string | string[]

export type SuggestMode = 'always' | 'missing' | 'popular'

export type TaskFailure = {
  node_id: NodeId;
  reason: ErrorCause;
  status: string;
  task_id: number;
}

export type TaskId = string

export type TermFrequencyNormalization = 'h1' | 'h2' | 'h3' | 'no' | 'z'

export type ThreadInfo = {
  active_threads: number;
  thread_executions: number;
}

export type TimeOfDay = string

export type TimeUnit = 'nanos' | 'micros' | 'ms' | 's' | 'm' | 'h' | 'd'

export type TimeZone = string

export type TopLeftBottomRightGeoBounds = {
  bottom_right: GeoLocation;
  top_left: GeoLocation;
}

export type TopRightBottomLeftGeoBounds = {
  bottom_left: GeoLocation;
  top_right: GeoLocation;
}

export type TranslogStats = {
  earliest_last_modified_age: number;
  operations: number;
  remote_store?: RemoteStoreTranslogStats;
  size?: HumanReadableByteCount;
  size_in_bytes: ByteCount;
  uncommitted_operations: number;
  uncommitted_size?: HumanReadableByteCount;
  uncommitted_size_in_bytes: ByteCount;
}

export type TransportAddress = string

export type Type = string

export type uint = number

export type ulong = number

export type UnitMicros = number

export type UnitMillis = number

export type UnitNanos = number

export type UnitSeconds = number

export type Username = string

export type Uuid = string

export type VersionNumber = number

export type VersionString = string

export type VersionType = 'external' | 'external_gte' | 'force' | 'internal'

export type Void = Record<string, any>

export type WaitForActiveShardOptions = 'all' | 'index-setting'

export type WaitForActiveShards = number | WaitForActiveShardOptions

export type WaitForEvents = 'immediate' | 'urgent' | 'high' | 'normal' | 'low' | 'languid'

export type WarmerStats = {
  current: number;
  total: number;
  total_time?: Duration;
  total_time_in_millis: DurationValueUnitMillis;
}

export type WktGeoBounds = {
  wkt: string;
}

export type WriteResponseBase = {
  _id: Id;
  _index: IndexName;
  _primary_term: number;
  _seq_no: SequenceNumber;
  _shards: ShardStatistics;
  _type?: Type;
  _version: VersionNumber;
  forced_refresh?: boolean;
  result: Result;
}

export type XyCartesianCoordinates = {
  x: number;
  y: number;
}

export type XyLocation = XyCartesianCoordinates | number[] | string

