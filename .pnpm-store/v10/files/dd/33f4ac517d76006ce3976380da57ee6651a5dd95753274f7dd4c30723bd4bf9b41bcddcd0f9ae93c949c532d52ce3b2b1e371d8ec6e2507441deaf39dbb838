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

export type Action = {
  action_type?: string;
  headers?: Headers;
  method?: string;
  post_process_function?: string;
  pre_process_function?: string;
  request_body?: string;
  url?: string;
}

export type AdditionalInfo = Record<string, any>

export type Aggregation = {
  field?: string;
  max?: Aggregation;
  sum?: Aggregation;
  [key: string]: any;
}

export type Algorithm = {
  value?: FunctionName;
}

export type AlgorithmOperations = {
  deploy?: ModelStats;
  execute?: ModelStats;
  predict?: ModelStats;
  register?: ModelStats;
  train?: ModelStats;
  train_predict?: ModelStats;
  undeploy?: ModelStats;
}

export type Algorithms = Record<string, AlgorithmOperations>

export type BoolQuery = {
  filter?: Filter[];
  must?: Filter[];
  must_not?: Filter;
  should?: Filter[];
}

export type Buckets = {
  end_time?: number;
  entities?: Entity[];
  overall_aggregate_value?: number;
  start_time?: number;
}

export type ByteBuffer = {
  array?: string;
  order?: 'BIG_ENDIAN' | 'LITTLE_ENDIAN';
}

export type ClientConfig = {
  connection_timeout?: number;
  max_connection?: number;
  max_retry_times?: number;
  read_timeout?: number;
  retry_backoff_millis?: number;
  retry_backoff_policy?: string;
  retry_timeout_seconds?: number;
}

export type ColumnMeta = {
  column_type?: 'BOOLEAN' | 'DOUBLE' | 'INTEGER' | 'STRING';
  name?: Common.Name;
}

export type Credential = {
  access_key?: string;
  secret_key?: string;
  session_token?: string;
  [key: string]: any;
}

export type Entity = {
  base_value?: number;
  contribution_value?: number;
  key?: string[];
  new_value?: number;
}

export type ExecuteAlgorithmResponse = ExecuteLocalSampleCalculatorResponse | {
  results?: ExecuteAnomalyLocalizationResponse[];
}

export type ExecuteAnomalyLocalizationResponse = {
  name?: string;
  result?: Result;
}

export type ExecuteLocalSampleCalculatorResponse = {
  result?: number;
}

export type Exists = {
  field?: Common.Field;
}

export type Filter = {
  exists?: Exists;
  match?: Match;
  nested?: Nested;
  range?: Range;
  term?: Term;
  terms?: Term;
}

export type FunctionName = 'AD_LIBSVM' | 'AGENT' | 'ANOMALY_LOCALIZATION' | 'BATCH_RCF' | 'CONNECTOR' | 'FIT_RCF' | 'KMEANS' | 'LINEAR_REGRESSION' | 'LOCAL_SAMPLE_CALCULATOR' | 'LOGISTIC_REGRESSION' | 'METRICS_CORRELATION' | 'QUESTION_ANSWERING' | 'RCF_SUMMARIZE' | 'REMOTE' | 'SAMPLE_ALGO' | 'SPARSE_ENCODING' | 'SPARSE_TOKENIZE' | 'TEXT_EMBEDDING' | 'TEXT_SIMILARITY'

export type GetAgentResponse = {
  created_time?: number;
  description?: string;
  is_hidden?: boolean;
  last_updated_time?: number;
  name?: Common.Name;
  tools?: ToolItems[];
  type?: 'conversational' | 'conversational_flow' | 'flow';
}

export type GetConnectorResponse = {
  actions?: Action[];
  created_time?: number;
  description?: string;
  last_updated_time?: number;
  name?: Common.Name;
  parameters?: Parameters;
  protocol?: 'aws_sigv4' | 'http';
  version?: Common.VersionString;
}

export type GetProfileResponse = {
  nodes?: Nodes;
}

export type GetStatsResponse = {
  ml_config_index_status?: 'green' | 'non-existent' | 'red' | 'yellow';
  ml_connector_count?: number;
  ml_connector_index_status?: 'green' | 'non-existent' | 'red' | 'yellow';
  ml_controller_index_status?: 'green' | 'non-existent' | 'red' | 'yellow';
  ml_model_count?: number;
  ml_model_index_status?: 'green' | 'non-existent' | 'red' | 'yellow';
  ml_task_index_status?: 'green' | 'non-existent' | 'red' | 'yellow';
  nodes?: NodeStats;
}

export type Guardrails = {
  index_name?: Common.IndexName;
  input_guardrail?: GuardrailsInputOutput;
  model_id?: string;
  output_guardrail?: GuardrailsInputOutput;
  regex?: Record<string, any>;
  response_filter?: string;
  response_validation_regex?: string;
  source_fields?: Common.Fields;
  stop_words?: Common_Analysis.StopWords;
  type?: 'local_regex' | 'model';
}

export type GuardrailsInputOutput = {
  model_id?: string;
  response_validation_regex?: string;
}

export type Headers = {
  content_type?: string;
  [key: string]: any;
}

export type HitsTotal = {
  relation: string;
  value: number;
}

export type InferenceResults = {
  output?: Output[];
}

export type InputQuery = {
  _source?: string[];
  query?: Query;
  size?: number;
}

export type Key = {
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
}

export type LLM = {
  model_id?: string;
  parameters?: Parameters;
}

export type Match = {
  description?: string;
  [key: string]: any;
}

export type MatchAllQuery = Record<string, any>

export type Memory = {
  additional_info?: AdditionalInfo;
  create_time?: string;
  memory_id?: Common.Name;
  name?: Common.Name;
  type?: string;
  updated_time?: string;
  user?: string;
}

export type Message = {
  additional_info?: AdditionalInfo;
  create_time?: string;
  input?: undefined | string;
  memory_id?: Common.Name;
  message_id?: Common.Name;
  origin?: undefined | string;
  parent_message_id?: undefined | string;
  prompt_template?: undefined | string;
  response?: undefined | string;
  trace_number?: number;
}

export type Model = {
  algorithm?: string;
  created_time?: number;
  is_hidden?: boolean;
  last_registered_time?: number;
  last_updated_time?: number;
  model_config?: ModelConfig;
  model_content_hash_value?: string;
  model_content_size_in_bytes?: number;
  model_format?: ModelFormat;
  model_group_id?: string;
  model_state: 'DEPLOYED' | 'DEPLOYING' | 'DEPLOY_FAILED' | 'PARTIALLY_DEPLOYED' | 'REGISTERED' | 'REGISTERING' | 'UNDEPLOYED';
  model_version?: string;
  name?: string;
  total_chunks?: number;
}

export type ModelConfig = {
  all_config?: string;
  embedding_dimension?: number;
  framework_type?: string;
  model_type?: string;
}

export type ModelFormat = 'ONNX' | 'TORCH_SCRIPT'

export type ModelGroup = {
  access: 'private' | 'public' | 'restricted';
  created_time?: number;
  description: string;
  last_updated_time?: number;
  latest_version: number;
  name: string;
  owner?: Owner;
}

export type ModelGroupRegistration = {
  model_group_id: string;
  status: string;
}

export type ModelProfile = {
  deploy?: ModelStats;
  execute?: ModelStats;
  memory_size_estimation_cpu?: number;
  memory_size_estimation_gpu?: number;
  model_state?: 'DEPLOYED' | 'DEPLOYING' | 'DEPLOY_FAILED' | 'PARTIALLY_DEPLOYED' | 'REGISTERED' | 'REGISTERING' | 'UNDEPLOYED';
  predict?: ModelStats;
  predict_request_stats?: PredictRequestStats;
  predictor?: string;
  register?: ModelStats;
  target_worker_nodes?: Common.NodeIds[];
  train?: ModelStats;
  train_predict?: ModelStats;
  undeploy?: ModelStats;
  worker_nodes?: Common.NodeIds[];
}

export type Models = Record<string, ModelProfile>

export type ModelStats = {
  ml_action_failure_count?: number;
  ml_action_request_count?: number;
  ml_executing_task_count?: number;
}

export type Nested = {
  boost?: number;
  ignore_unmapped?: boolean;
  path?: Common.Field;
  query?: Query;
  score_mode?: 'avg' | 'max' | 'min' | 'none' | 'sum';
}

export type Node = {
  models?: Models;
  tasks?: Tasks;
}

export type Nodes = Record<string, Node>

export type NodeStats = Record<string, NodeStatsDetails>

export type NodeStatsDetails = {
  algorithms?: Algorithms;
  ml_circuit_breaker_trigger_count?: number;
  ml_deployed_model_count?: number;
  ml_executing_task_count?: number;
  ml_failure_count?: number;
  ml_jvm_heap_usage?: number;
  ml_request_count?: number;
  models?: Models;
}

export type Output = {
  byte_buffer?: ByteBuffer;
  data: number[];
  data_type?: 'BOOLEAN' | 'FLOAT16' | 'FLOAT32' | 'FLOAT64' | 'INT32' | 'INT64' | 'INT8' | 'STRING' | 'UINT8' | 'UNKNOWN';
  name?: string;
  result?: string;
  shape?: number[];
}

export type Owner = {
  backend_roles?: string[];
  custom_attribute_names?: string[];
  name: Common.Name;
  roles?: string[];
  user_requested_tenant?: undefined | string;
}

export type OwnerNameKeyword = {
  boost?: number;
  value?: Common.FieldValue;
}

export type Parameters = Record<string, any>

export type PredictionResult = {
  column_metas?: ColumnMeta[];
  rows?: Rows[];
}

export type PredictModelOutput = {
  byte_buffer?: ByteBuffer;
  data: number[];
  data_type?: 'BOOLEAN' | 'FLOAT16' | 'FLOAT32' | 'FLOAT64' | 'INT32' | 'INT64' | 'INT8' | 'STRING' | 'UINT8' | 'UNKNOWN';
  name?: string;
  shape?: number[];
}

export type PredictModelResponse = {
  inference_results?: PredictModelResult[];
}

export type PredictModelResult = {
  output?: PredictModelOutput[];
}

export type PredictRequestStats = {
  average?: number;
  count?: number;
  max?: number;
  min?: number;
  p50?: number;
  p90?: number;
  p99?: number;
}

export type PredictResponse = {
  inference_results?: InferenceResults[];
  prediction_result?: PredictionResult;
  status?: Status;
}

export type ProfileRequest = {
  model_ids?: Common.Id[];
  node_ids?: Common.Id[];
  return_all_models?: boolean;
  return_all_tasks?: boolean;
  task_ids?: Common.Id[];
}

export type Query = {
  bool?: BoolQuery;
  match?: Match;
  match_all?: MatchAllQuery;
  term?: Term;
  [key: string]: any;
}

export type Range = {
  k1?: Key;
  k2?: Key;
  k3?: Key;
}

export type RateLimiter = {
  limit: Common.StringifiedDouble;
  unit: 'DAYS' | 'HOURS' | 'MICROSECONDS' | 'MILLISECONDS' | 'MINUTES' | 'NANOSECONDS' | 'SECONDS';
}

export type Result = {
  buckets?: Buckets[];
}

export type Rows = {
  values?: Values[];
}

export type SearchAgentsResponse = SearchResponse

export type SearchConnectorsResponse = SearchResponse

export type SearchHits = {
  hits: SearchHitsHit[];
  max_score?: undefined | number;
  total: HitsTotal;
}

export type SearchHitsHit = {
  _id?: Common.Id;
  _index?: Common.IndexName;
  _primary_term?: number;
  _score: undefined | number;
  _seq_no?: Common.SequenceNumber;
  _source?: Source;
  _version?: Common.VersionNumber;
  model_id?: Common.Name;
  sort?: number[];
}

export type SearchMemoryResponse = SearchResponse

export type SearchMessageResponse = SearchResponse

export type SearchModelGroupsResponse = SearchResponse

export type SearchModelsResponse = SearchResponse

export type SearchResponse = {
  _shards?: Common.ShardStatistics;
  hits: SearchHits;
  timed_out?: boolean;
  took?: number;
}

export type SearchTasksResponse = SearchResponse

export type Sort = {
  _id?: SortOrder;
  _index?: SortOrder;
  _score?: SortOrder;
  _seq_no?: SortOrder;
  algorithm?: SortOrder;
  auto_redeploy_retry_times?: SortOrder;
  chunk_number?: SortOrder;
  created_time?: SortOrder;
  current_worker_node_count?: SortOrder;
  deploy_to_all_nodes?: SortOrder;
  is_hidden?: SortOrder;
  last_registered_time?: SortOrder;
  last_updated_time?: SortOrder;
  model_content_hash_value?: SortOrder;
  model_content_size_in_bytes?: SortOrder;
  model_format?: SortOrder;
  model_group_id?: SortOrder;
  model_state?: SortOrder;
  model_version?: SortOrder;
  planning_worker_node_count?: SortOrder;
  planning_worker_nodes?: SortOrder;
  total_chunks?: SortOrder;
}

export type SortAgent = {
  _id?: SortOrder;
  _index?: SortOrder;
  _score?: SortOrder;
  _seq_no?: SortOrder;
  created_time?: SortOrder;
  is_hidden?: SortOrder;
  last_updated_time?: SortOrder;
  parameters?: SortOrder;
  tools?: SortOrder;
  type?: SortOrder;
}

export type SortMemory = {
  _id?: SortOrder;
  _index?: SortOrder;
  _score?: SortOrder;
  _seq_no?: SortOrder;
  additional_info?: SortOrder;
  application_time?: SortOrder;
  create_time?: SortOrder;
  updated_time?: SortOrder;
  user?: SortOrder;
}

export type SortMessage = {
  _id?: SortOrder;
  _index?: SortOrder;
  _score?: SortOrder;
  _seq_no?: SortOrder;
  additional_info?: SortOrder;
  create_time?: SortOrder;
  memory_id?: SortOrder;
  origin?: SortOrder;
  parent_message_id?: SortOrder;
  trace_number?: SortOrder;
}

export type SortOrder = {
  order?: 'asc' | 'desc';
}

export type Source = {
  access?: 'private' | 'public' | 'restricted';
  actions?: Action[];
  additional_info?: AdditionalInfo;
  algorithm?: string;
  app_type?: string;
  application_type?: undefined | string;
  auto_redeploy_retry_times?: number;
  backend_roles?: string[];
  chunk_number?: number;
  connector_id?: string;
  create_time?: string | number;
  created_time?: number;
  current_worker_node_count?: number;
  deploy_to_all_nodes?: boolean;
  description?: string;
  error?: string;
  function_name?: FunctionName;
  input?: undefined | string;
  input_type?: 'DATA_FRAME' | 'QUESTION_ANSWERING' | 'REMOTE' | 'SEARCH_QUERY' | 'TEXT_DOCS' | 'TEXT_SIMILARITY';
  is_async?: boolean;
  is_hidden?: boolean;
  last_deployed_time?: number;
  last_registered_time?: number;
  last_update_time?: number;
  last_updated_time?: number;
  latest_version?: number;
  memory?: Memory;
  memory_id?: Common.Name;
  model_config?: ModelConfig;
  model_content_hash_value?: string;
  model_content_size_in_bytes?: number;
  model_format?: ModelFormat;
  model_group_id?: string;
  model_id?: Common.Name;
  model_state?: 'DEPLOYED' | 'DEPLOYING' | 'DEPLOY_FAILED' | 'PARTIALLY_DEPLOYED' | 'REGISTERED' | 'REGISTERING' | 'UNDEPLOYED';
  model_task_type?: string;
  model_version?: string;
  name?: Common.Name;
  origin?: undefined | string;
  owner?: Owner;
  parameters?: Parameters;
  parent_message_id?: undefined | string;
  planning_worker_node_count?: number;
  planning_worker_nodes?: Common.NodeIds[];
  prompt_template?: undefined | string;
  protocol?: 'aws_sigv4' | 'http';
  response?: undefined | string;
  state?: Status;
  task_type?: 'BATCH_INGEST' | 'BATCH_PREDICTION' | 'DEPLOY_MODEL' | 'EXECUTION' | 'PREDICTION' | 'REGISTER_MODEL' | 'TRAINING' | 'TRAINING_AND_PREDICTION';
  tools?: ToolItems[];
  total_chunks?: number;
  trace_number?: undefined | string;
  type?: 'conversational' | 'conversational_flow' | 'flow';
  updated_time?: string;
  url?: string;
  user?: string;
  version?: Common.VersionString;
  worker_node?: Common.NodeIds[];
}

export type Status = 'CANCELLED' | 'COMPLETED' | 'COMPLETED_WITH_ERROR' | 'CREATED' | 'FAILED' | 'RUNNING'

export type Task = {
  create_time?: number;
  error?: string;
  function_name?: FunctionName;
  is_async?: boolean;
  last_update_time?: number;
  model_id?: string;
  state: 'CANCELLED' | 'CANCELLING' | 'COMPLETED' | 'COMPLETED_WITH_ERROR' | 'CREATED' | 'EXPIRED' | 'FAILED' | 'RUNNING';
  task_id?: string;
  task_type?: 'BATCH_INGEST' | 'BATCH_PREDICTION' | 'DEPLOY_MODEL' | 'EXECUTION' | 'PREDICTION' | 'REGISTER_MODEL' | 'TRAINING' | 'TRAINING_AND_PREDICTION';
  worker_node?: Common.NodeIds[];
}

export type Tasks = Record<string, Task>

export type Term = {
  _id?: Common.Id[];
  algorithm?: Algorithm;
  function_name?: FunctionName;
  model_id?: Common.Name;
  name?: OwnerNameKeyword;
  'owner.name.keyword'?: OwnerNameKeyword;
  type?: Type;
}

export type Tool = {
  description?: string;
  name?: Common.Name;
  type?: string;
  version?: Common.VersionString;
}

export type ToolItems = {
  include_output_in_agent_response?: boolean;
  name?: string;
  parameters?: Parameters;
  type?: string;
  [key: string]: any;
}

export type TrainParameters = {
  centroids?: number;
  distance_type?: 'COSINE' | 'EUCLIDEAN' | 'L1';
  iterations?: number;
}

export type TrainPredictResponse = {
  prediction_result?: PredictionResult;
  status: Status;
}

export type TrainResponse = {
  model_id?: Common.Name;
  status: Status;
}

export type Type = {
  value?: 'conversational' | 'conversational_flow' | 'flow';
}

export type UndeployModelNode = {
  stats?: UndeployModelNodeStats;
}

export type UndeployModelNodeStats = Record<string, any>

export type UndeployModelResponse = Record<string, UndeployModelNode>

export type UnloadModelNode = {
  stats?: UnloadModelNodeStats;
}

export type UnloadModelNodeStats = Record<string, any>

export type UnloadModelResponse = Record<string, UnloadModelNode>

export type UpdateModelGroupResponse = {
  status?: string;
}

export type Values = {
  column_type?: 'BOOLEAN' | 'DOUBLE' | 'INTEGER' | 'STRING';
  value?: number;
}

