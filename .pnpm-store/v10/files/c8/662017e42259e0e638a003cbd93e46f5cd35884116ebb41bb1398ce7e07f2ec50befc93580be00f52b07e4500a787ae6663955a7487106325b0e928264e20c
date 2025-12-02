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

export type Action = {
  alias?: ActionAlias;
  allocation?: ActionAllocation;
  close?: ActionClose;
  custom?: ActionCustom;
  delete?: ActionDelete;
  force_merge?: ActionForceMerge;
  index_priority?: ActionIndexPriority;
  notification?: ActionNotification;
  open?: ActionOpen;
  read_only?: ActionReadOnly;
  read_write?: ActionReadWrite;
  replica_count?: ActionReplicaCount;
  retry?: ActionRetry;
  rollover?: ActionRollover;
  rollup?: ActionRollup;
  shrink?: ActionShrink;
  snapshot?: ActionSnapshot;
  timeout?: ActionTimeout;
  transform?: ActionTransform;
}

export type ActionAlias = {
  actions?: Record<string, any>;
}

export type ActionAllocation = {
  exclude?: Record<string, any>;
  include?: Record<string, any>;
  require?: Record<string, any>;
  wait_for?: boolean;
}

export type ActionClose = Record<string, any>

export type ActionCustom = Record<string, any>

export type ActionDelete = Record<string, any>

export type ActionForceMerge = {
  max_num_segments?: number;
}

export type ActionIndexPriority = {
  priority?: number;
}

export type ActionNotification = Record<string, any>

export type ActionOpen = Record<string, any>

export type ActionReadOnly = Record<string, any>

export type ActionReadWrite = Record<string, any>

export type ActionReplicaCount = {
  number_of_replicas?: number;
}

export type ActionRetry = {
  backoff?: string;
  count?: number;
  delay?: string;
}

export type ActionRollover = {
  copy_alias?: boolean;
  min_doc_count?: number;
  min_index_age?: number;
  min_primary_shard_size?: number;
  min_size?: number;
}

export type ActionRollup = Record<string, any>

export type ActionShrink = Record<string, any>

export type ActionSnapshot = {
  include_global_state?: boolean;
  repository?: string;
  snapshot?: string;
}

export type ActionTimeout = {
  timeout?: Record<string, any>;
}

export type ActionTransform = Record<string, any>

export type AddPolicyRequest = {
  policy_id: string;
}

export type AddPolicyResponse = ChangePolicyResponse

export type ChangePolicyRequest = {
  include?: IncludeState[];
  policy_id: string;
  state?: string;
}

export type ChangePolicyResponse = ChangeResponse

export type ChangeResponse = {
  failed_indices?: FailedIndex[];
  failures?: boolean;
  updated_indices?: number;
}

export type Channel = {
  id?: string;
}

export type DeletePolicyResponse = Common.WriteResponseBase

export type ErrorNotification = {
  channel?: Channel;
  destination?: ErrorNotificationDestination;
  message_template?: Record<string, any>;
}

export type ErrorNotificationChime = {
  url?: string;
}

export type ErrorNotificationDestination = {
  last_update_time?: number;
  name?: string;
  [key: string]: any | ErrorNotificationChime | ErrorNotificationSlack;
}

export type ErrorNotificationSlack = {
  custom_webhook?: SlackCustomWebhook;
  url?: string;
}

export type ExplainIndexResponse = {
  total_managed_indices?: number;
  [key: string]: any | ExplainPolicy;
}

export type ExplainPolicy = {
  enabled?: boolean | undefined;
  'index.opendistro.index_state_management.policy_id'?: undefined | string;
  'index.plugins.index_state_management.policy_id'?: undefined | string;
}

export type FailedIndex = {
  index_name?: string;
  index_uuid?: string;
  reason?: string;
}

export type GetPoliciesResponse = {
  policies?: PolicyWithMetadata[];
  total_policies?: number;
}

export type GetPolicyResponse = PolicyWithMetadata

export type IncludeState = {
  state?: string;
}

export type IsmTemplate = {
  index_patterns?: string[];
  last_updated_time?: number;
  priority?: number;
}

export type Metadata = {
  _id?: Common.Id;
  _primary_term?: number;
  _seq_no?: Common.SequenceNumber;
  _version?: Common.VersionNumber;
}

export type Policy = {
  default_state?: string;
  description?: string;
  error_notification?: ErrorNotification | undefined;
  ism_template?: IsmTemplate | undefined | IsmTemplate[];
  last_updated_time?: number;
  policy_id?: string;
  schema_version?: number;
  states?: States[];
}

export type PolicyEnvelope = {
  policy?: Policy;
}

export type PolicyWithMetadata = Metadata & PolicyEnvelope

export type PutPolicyRequest = PolicyEnvelope

export type PutPolicyResponse = Metadata & {
  policy?: PolicyEnvelope;
}

export type RefreshSearchAnalyzersResponse = {
  _shards?: Common.ShardStatistics;
  successful_refresh_details?: RefreshSearchAnalyzersResponseDetails[];
}

export type RefreshSearchAnalyzersResponseDetails = {
  index?: string;
  refreshed_analyzers?: string[];
}

export type RemovePolicyResponse = ChangePolicyResponse

export type RetryIndexRequest = {
  state: string;
}

export type RetryIndexResponse = ChangeResponse

export type SlackCustomWebhook = {
  header_params?: Record<string, any>;
  host?: string;
  password?: string;
  path?: string;
  port?: number;
  query_params?: Record<string, any>;
  scheme?: string;
  url?: string;
  username?: string;
}

export type States = {
  actions?: Action[];
  name?: string;
  transitions?: Transition[];
}

export type Transition = {
  conditions?: Record<string, any>;
  state_name?: string;
}

