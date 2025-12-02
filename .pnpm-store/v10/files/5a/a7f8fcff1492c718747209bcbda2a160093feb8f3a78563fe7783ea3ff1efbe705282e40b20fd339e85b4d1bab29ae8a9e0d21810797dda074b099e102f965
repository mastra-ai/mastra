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
import * as Indices_Common from './indices._common'

export type Metric = '_all' | 'aggregations' | 'http' | 'indices' | 'ingest' | 'jvm' | 'os' | 'plugins' | 'process' | 'search_pipelines' | 'settings' | 'thread_pool' | 'transport'

export type NodeInfo = {
  aggregations?: Record<string, NodeInfoAggregation>;
  attributes?: Record<string, string>;
  build_flavor?: string;
  build_hash: string;
  build_type: string;
  host?: Common.Host;
  http?: NodeInfoHttp;
  ingest?: NodeInfoIngest;
  ip?: Common.Ip;
  jvm?: NodeJvmInfo;
  modules?: Common.PluginStats[];
  name: Common.Name;
  network?: NodeInfoNetwork;
  os?: NodeOperatingSystemInfo;
  plugins?: Common.PluginStats[];
  process?: NodeProcessInfo;
  roles: Common.NodeRoles;
  search_pipelines?: NodeInfoSearchPipelines;
  settings?: NodeInfoSettings;
  thread_pool?: Record<string, NodeThreadPoolInfo>;
  total_indexing_buffer?: Common.ByteCount | Common.HumanReadableByteCount;
  total_indexing_buffer_in_bytes?: Common.HumanReadableByteCount | Common.ByteCount;
  transport?: NodeInfoTransport;
  transport_address?: Common.TransportAddress;
  version: Common.VersionString;
}

export type NodeInfoAction = {
  destructive_requires_name: string;
}

export type NodeInfoAggregation = {
  types: string[];
}

export type NodeInfoBootstrap = {
  memory_lock: string;
}

export type NodeInfoClient = {
  type: string;
}

export type NodeInfoDiscovery = {
  seed_hosts?: string;
  type?: string;
}

export type NodeInfoHttp = {
  bound_address: string[];
  max_content_length?: Common.HumanReadableByteCount;
  max_content_length_in_bytes: Common.ByteCount;
  publish_address: string;
}

export type NodeInfoIngest = {
  processors: NodeInfoIngestProcessor[];
}

export type NodeInfoIngestDownloader = {
  enabled: string;
}

export type NodeInfoIngestInfo = {
  downloader: NodeInfoIngestDownloader;
}

export type NodeInfoIngestProcessor = {
  type: string;
}

export type NodeInfoJvmMemory = {
  direct_max?: Common.HumanReadableByteCount;
  direct_max_in_bytes: Common.ByteCount;
  heap_init?: Common.HumanReadableByteCount;
  heap_init_in_bytes: Common.ByteCount;
  heap_max?: Common.HumanReadableByteCount;
  heap_max_in_bytes: Common.ByteCount;
  non_heap_init?: Common.HumanReadableByteCount;
  non_heap_init_in_bytes: Common.ByteCount;
  non_heap_max?: Common.HumanReadableByteCount;
  non_heap_max_in_bytes: Common.ByteCount;
}

export type NodeInfoMemory = {
  total: Common.HumanReadableByteCount;
  total_in_bytes: Common.ByteCount;
}

export type NodeInfoNetwork = {
  primary_interface: NodeInfoNetworkInterface;
  refresh_interval: number;
}

export type NodeInfoNetworkInterface = {
  address: string;
  mac_address: string;
  name: Common.Name;
}

export type NodeInfoOSCPU = {
  cache_size: Common.HumanReadableByteCount;
  cache_size_in_bytes: Common.ByteCount;
  cores_per_socket: number;
  mhz: number;
  model: string;
  total_cores: number;
  total_sockets: number;
  vendor: string;
}

export type NodeInfoPath = {
  data?: string[];
  home: string;
  logs: string;
  repo?: string[];
}

export type NodeInfoRepositories = {
  url: NodeInfoRepositoriesUrl;
}

export type NodeInfoRepositoriesUrl = {
  allowed_urls: string;
}

export type NodeInfoScript = {
  allowed_types: string;
  disable_max_compilations_rate: string;
}

export type NodeInfoSearch = {
  remote: NodeInfoSearchRemote;
}

export type NodeInfoSearchPipelines = {
  request_processors?: NodeInfoIngestProcessor[];
  response_processors?: NodeInfoIngestProcessor[];
}

export type NodeInfoSearchRemote = {
  connect: string;
}

export type NodeInfoSettings = {
  action?: NodeInfoAction;
  bootstrap?: NodeInfoBootstrap;
  client: NodeInfoClient;
  cluster: NodeInfoSettingsCluster;
  discovery?: NodeInfoDiscovery;
  http: NodeInfoSettingsHttp;
  index?: NodeInfoSettingsIndex;
  ingest?: NodeInfoSettingsIngest;
  network?: NodeInfoSettingsNetwork;
  node: NodeInfoSettingsNode;
  path: NodeInfoPath;
  plugins?: NodeInfoSettingsPlugins;
  repositories?: NodeInfoRepositories;
  script?: NodeInfoScript;
  search?: NodeInfoSearch;
  transport: NodeInfoSettingsTransport;
}

export type NodeInfoSettingsCluster = {
  deprecation_indexing?: NodeInfoSettingsDeprecationIndexing;
  election?: NodeInfoSettingsClusterElection;
  initial_cluster_manager_nodes?: Common.StringOrStringArray;
  initial_master_nodes?: Common.StringOrStringArray;
  name: Common.Name;
  routing?: Indices_Common.IndexRouting;
}

export type NodeInfoSettingsClusterElection = {
  strategy: Common.Name;
}

export type NodeInfoSettingsDeprecationIndexing = {
  enabled: Common.StringifiedBoolean;
}

export type NodeInfoSettingsHttp = {
  compression?: Common.StringifiedBoolean;
  port?: Common.StringifiedInteger;
  type: NodeInfoSettingsHttpType;
  'type.default'?: string;
}

export type NodeInfoSettingsHttpType = string | NodeInfoSettingsHttpTypeConfig

export type NodeInfoSettingsHttpTypeConfig = {
  default?: string;
}

export type NodeInfoSettingsIndex = {
  store?: NodeInfoSettingsIndexStore;
}

export type NodeInfoSettingsIndexHybrid = {
  mmap?: NodeInfoSettingsIndexStoreMmap;
}

export type NodeInfoSettingsIndexStore = {
  hybrid?: NodeInfoSettingsIndexHybrid;
}

export type NodeInfoSettingsIndexStoreMmap = {
  extensions?: string[];
}

export type NodeInfoSettingsIngest = {
  append?: NodeInfoIngestInfo;
  attachment?: NodeInfoIngestInfo;
  bytes?: NodeInfoIngestInfo;
  circle?: NodeInfoIngestInfo;
  convert?: NodeInfoIngestInfo;
  csv?: NodeInfoIngestInfo;
  date?: NodeInfoIngestInfo;
  date_index_name?: NodeInfoIngestInfo;
  dissect?: NodeInfoIngestInfo;
  dot_expander?: NodeInfoIngestInfo;
  drop?: NodeInfoIngestInfo;
  enrich?: NodeInfoIngestInfo;
  fail?: NodeInfoIngestInfo;
  foreach?: NodeInfoIngestInfo;
  geoip?: NodeInfoIngestInfo;
  grok?: NodeInfoIngestInfo;
  gsub?: NodeInfoIngestInfo;
  inference?: NodeInfoIngestInfo;
  join?: NodeInfoIngestInfo;
  json?: NodeInfoIngestInfo;
  kv?: NodeInfoIngestInfo;
  lowercase?: NodeInfoIngestInfo;
  pipeline?: NodeInfoIngestInfo;
  remove?: NodeInfoIngestInfo;
  rename?: NodeInfoIngestInfo;
  script?: NodeInfoIngestInfo;
  set?: NodeInfoIngestInfo;
  set_security_user?: NodeInfoIngestInfo;
  sort?: NodeInfoIngestInfo;
  split?: NodeInfoIngestInfo;
  trim?: NodeInfoIngestInfo;
  uppercase?: NodeInfoIngestInfo;
  urldecode?: NodeInfoIngestInfo;
  user_agent?: NodeInfoIngestInfo;
}

export type NodeInfoSettingsNetwork = {
  host: Common.Host;
}

export type NodeInfoSettingsNode = {
  attr?: Record<string, any>;
  max_local_storage_nodes?: string;
  name: Common.Name;
}

export type NodeInfoSettingsPlugins = Record<string, any>

export type NodeInfoSettingsTransport = {
  type: NodeInfoSettingsTransportType;
  'type.default'?: string;
}

export type NodeInfoSettingsTransportType = string | NodeInfoSettingsTransportTypeConfig

export type NodeInfoSettingsTransportTypeConfig = {
  default?: string;
}

export type NodeInfoTransport = {
  bound_address: string[];
  profiles: Record<string, string>;
  publish_address: string;
}

export type NodeJvmInfo = {
  bundled_jdk: boolean;
  gc_collectors?: string[];
  input_arguments?: string[];
  mem: NodeInfoJvmMemory;
  memory_pools?: string[];
  pid: number;
  start_time?: Common.DateTime;
  start_time_in_millis: Common.EpochTimeUnitMillis;
  using_bundled_jdk?: boolean | undefined;
  using_compressed_ordinary_object_pointers?: Common.StringifiedBoolean;
  version?: Common.VersionString;
  vm_name?: Common.Name;
  vm_vendor?: string;
  vm_version?: Common.VersionString;
}

export type NodeOperatingSystemInfo = {
  allocated_processors?: number;
  arch?: string;
  available_processors: number;
  cpu?: NodeInfoOSCPU;
  mem?: NodeInfoMemory;
  name?: Common.Name;
  pretty_name?: Common.Name;
  refresh_interval?: Common.Duration;
  refresh_interval_in_millis: Common.DurationValueUnitMillis;
  swap?: NodeInfoMemory;
  version?: Common.VersionString;
}

export type NodeProcessInfo = {
  id: number;
  mlockall: boolean;
  refresh_interval?: Common.Duration;
  refresh_interval_in_millis: Common.DurationValueUnitMillis;
}

export type NodeThreadPoolInfo = {
  core?: number;
  keep_alive?: Common.Duration;
  max?: number;
  queue_size: number;
  size?: number;
  type: string;
}

