// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { SinglePage } from '../../pagination';

export class Tasks extends APIResource {
  /**
   * Task Search
   */
  list(
    params: TaskListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<TaskListResponsesSinglePage, TaskListResponse> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/ai/tasks/search`,
      TaskListResponsesSinglePage,
      options,
    );
  }
}

export class TaskListResponsesSinglePage extends SinglePage<TaskListResponse> {}

export type TaskListResponse = unknown;

export interface TaskListParams {
  account_id: string;
}

Tasks.TaskListResponsesSinglePage = TaskListResponsesSinglePage;

export declare namespace Tasks {
  export {
    type TaskListResponse as TaskListResponse,
    TaskListResponsesSinglePage as TaskListResponsesSinglePage,
    type TaskListParams as TaskListParams,
  };
}
