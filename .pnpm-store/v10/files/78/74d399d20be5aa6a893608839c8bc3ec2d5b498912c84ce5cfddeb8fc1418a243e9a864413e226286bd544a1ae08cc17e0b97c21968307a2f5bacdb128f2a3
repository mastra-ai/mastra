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
import * as Common_QueryDsl from './_common.query_dsl'

export type All = boolean

export type AllowDelete = string

export type FlowFrameworkCreate = {
  description?: string;
  name: string;
  use_case?: string;
  version?: version;
  workflows?: Record<string, any>;
}

export type FlowFrameworkGetResponse = {
  created_time?: number;
  description?: string;
  last_provisioned_time?: number;
  last_updated_time?: number;
  name?: string;
  use_case?: string;
  user?: user;
  version?: version;
  workflows?: Record<string, any>;
}

export type FlowFrameworkUpdate = {
  description?: string;
  name?: string;
  use_case?: string;
  version?: version;
  workflows?: Record<string, any>;
}

export type hits = {
  hits?: itemsObject[];
  max_score?: undefined | number;
  total?: total;
}

export type itemsObject = {
  _id?: string;
  _index?: string;
  _primary_term?: number;
  _score?: number;
  _seq_no?: number;
  _source?: FlowFrameworkGetResponse;
  _version?: number;
}

export type Provision = boolean

export type Reprovision = boolean

export type ResourcesCreated = {
  resource_id?: string;
  resource_type?: string;
  workflow_step_id?: string;
  workflow_step_name?: string;
}

export type SearchStateResponse = {
  provision_end_time?: Common.DateTime;
  provision_start_time?: Common.DateTime;
  provisioning_progress?: string;
  resources_created?: ResourcesCreated;
  state?: string;
  user?: user;
  workflow_id?: string;
}

export type SearchWorkflowRequest = {
  query?: Common_QueryDsl.QueryContainer;
}

export type shards = {
  failed?: number;
  skipped?: number;
  successful?: number;
  total?: number;
}

export type StateHits = {
  hits?: StateItems[];
  max_score?: undefined | number;
  total?: total;
}

export type StateItems = {
  _id?: string;
  _index?: string;
  _primary_term?: number;
  _score?: number;
  _seq_no?: number;
  _source?: SearchStateResponse;
  _version?: number;
}

export type total = {
  relation?: string;
  value?: number;
}

export type UpdateFields = boolean

export type UseCase = string

export type user = {
  backend_roles?: string[];
  custom_attribute_names?: string[];
  name?: string;
  roles?: string[];
  user_requested_tenant?: string;
}

export type UserProvidedSubstitutionExpressions = Record<string, string>

export type Validation = string

export type version = {
  compatibility?: string[];
  template?: string;
}

export type WorkflowID = string

export type WorkflowIDResponse = {
  workflow_id?: string;
}

export type WorkflowSearchResponse = {
  _shards?: shards;
  hits?: hits;
  timed_out?: boolean;
  took?: number;
}

export type WorkflowSearchStateResponse = {
  _shards?: shards;
  hits?: StateHits;
  timed_out?: boolean;
  took?: number;
}

export type WorkFlowStatusDefaultResponse = {
  error?: string;
  resources_created?: string[];
  state?: string;
  workflow_id?: string;
}

export type WorkFlowStatusFullResponse = {
  error?: string;
  provision_end_time?: string;
  provision_start_time?: string;
  provisioning_progress?: string;
  resources_created?: string[];
  state?: 'COMPLETED' | 'FAILED' | 'NOT_STARTED' | 'PROVISIONING';
  user?: user;
  user_outputs?: string[];
  workflow_id?: string;
}

export type WorkflowStep = {
  inputs?: string[];
  outputs?: string[];
  required_plugins?: string[];
  timeout?: Common.Duration;
}

export type WorkflowStepName = string

export type WorkflowSteps = Record<string, WorkflowStep>

