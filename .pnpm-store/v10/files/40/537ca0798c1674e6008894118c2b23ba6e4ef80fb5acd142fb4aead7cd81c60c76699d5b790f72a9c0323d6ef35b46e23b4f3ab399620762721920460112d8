// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as VersionsAPI from './versions';
import {
  VersionGetParams,
  VersionGetResponse,
  VersionListParams,
  VersionListResponse,
  VersionListResponsesV4PagePaginationArray,
  Versions,
} from './versions';
import * as InstancesAPI from './instances/instances';
import {
  InstanceBulkParams,
  InstanceBulkResponse,
  InstanceBulkResponsesSinglePage,
  InstanceCreateParams,
  InstanceCreateResponse,
  InstanceGetParams,
  InstanceGetResponse,
  InstanceListParams,
  InstanceListResponse,
  InstanceListResponsesV4PagePaginationArray,
  Instances as InstancesAPIInstances,
} from './instances/instances';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../pagination';

export class Workflows extends APIResource {
  instances: InstancesAPI.Instances = new InstancesAPI.Instances(this._client);
  versions: VersionsAPI.Versions = new VersionsAPI.Versions(this._client);

  /**
   * Create/modify Workflow
   */
  update(
    workflowName: string,
    params: WorkflowUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<WorkflowUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/workflows/${workflowName}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: WorkflowUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List all Workflows
   */
  list(
    params: WorkflowListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<WorkflowListResponsesV4PagePaginationArray, WorkflowListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/workflows`,
      WorkflowListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Deletes a Workflow. This only deletes the Workflow and does not delete or modify
   * any Worker associated to this Workflow or bounded to it.
   */
  delete(
    workflowName: string,
    params: WorkflowDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<WorkflowDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(`/accounts/${account_id}/workflows/${workflowName}`, options) as Core.APIPromise<{
        result: WorkflowDeleteResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get Workflow details
   */
  get(
    workflowName: string,
    params: WorkflowGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<WorkflowGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/workflows/${workflowName}`, options) as Core.APIPromise<{
        result: WorkflowGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class WorkflowListResponsesV4PagePaginationArray extends V4PagePaginationArray<WorkflowListResponse> {}

export interface WorkflowUpdateResponse {
  id: string;

  class_name: string;

  created_on: string;

  is_deleted: number;

  modified_on: string;

  name: string;

  script_name: string;

  terminator_running: number;

  triggered_on: string | null;

  version_id: string;
}

export interface WorkflowListResponse {
  id: string;

  class_name: string;

  created_on: string;

  instances: WorkflowListResponse.Instances;

  modified_on: string;

  name: string;

  script_name: string;

  triggered_on: string | null;
}

export namespace WorkflowListResponse {
  export interface Instances {
    complete?: number;

    errored?: number;

    paused?: number;

    queued?: number;

    running?: number;

    terminated?: number;

    waiting?: number;

    waitingForPause?: number;
  }
}

export interface WorkflowDeleteResponse {
  status: 'ok';

  success: boolean | null;
}

export interface WorkflowGetResponse {
  id: string;

  class_name: string;

  created_on: string;

  instances: WorkflowGetResponse.Instances;

  modified_on: string;

  name: string;

  script_name: string;

  triggered_on: string | null;
}

export namespace WorkflowGetResponse {
  export interface Instances {
    complete?: number;

    errored?: number;

    paused?: number;

    queued?: number;

    running?: number;

    terminated?: number;

    waiting?: number;

    waitingForPause?: number;
  }
}

export interface WorkflowUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  class_name: string;

  /**
   * Body param:
   */
  script_name: string;
}

export interface WorkflowListParams extends V4PagePaginationArrayParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param: Allows filtering workflows` name.
   */
  search?: string;
}

export interface WorkflowDeleteParams {
  account_id: string;
}

export interface WorkflowGetParams {
  account_id: string;
}

Workflows.WorkflowListResponsesV4PagePaginationArray = WorkflowListResponsesV4PagePaginationArray;
Workflows.Instances = InstancesAPIInstances;
Workflows.InstanceListResponsesV4PagePaginationArray = InstanceListResponsesV4PagePaginationArray;
Workflows.InstanceBulkResponsesSinglePage = InstanceBulkResponsesSinglePage;
Workflows.Versions = Versions;
Workflows.VersionListResponsesV4PagePaginationArray = VersionListResponsesV4PagePaginationArray;

export declare namespace Workflows {
  export {
    type WorkflowUpdateResponse as WorkflowUpdateResponse,
    type WorkflowListResponse as WorkflowListResponse,
    type WorkflowDeleteResponse as WorkflowDeleteResponse,
    type WorkflowGetResponse as WorkflowGetResponse,
    WorkflowListResponsesV4PagePaginationArray as WorkflowListResponsesV4PagePaginationArray,
    type WorkflowUpdateParams as WorkflowUpdateParams,
    type WorkflowListParams as WorkflowListParams,
    type WorkflowDeleteParams as WorkflowDeleteParams,
    type WorkflowGetParams as WorkflowGetParams,
  };

  export {
    InstancesAPIInstances as Instances,
    type InstanceCreateResponse as InstanceCreateResponse,
    type InstanceListResponse as InstanceListResponse,
    type InstanceBulkResponse as InstanceBulkResponse,
    type InstanceGetResponse as InstanceGetResponse,
    InstanceListResponsesV4PagePaginationArray as InstanceListResponsesV4PagePaginationArray,
    InstanceBulkResponsesSinglePage as InstanceBulkResponsesSinglePage,
    type InstanceCreateParams as InstanceCreateParams,
    type InstanceListParams as InstanceListParams,
    type InstanceBulkParams as InstanceBulkParams,
    type InstanceGetParams as InstanceGetParams,
  };

  export {
    Versions as Versions,
    type VersionListResponse as VersionListResponse,
    type VersionGetResponse as VersionGetResponse,
    VersionListResponsesV4PagePaginationArray as VersionListResponsesV4PagePaginationArray,
    type VersionListParams as VersionListParams,
    type VersionGetParams as VersionGetParams,
  };
}
