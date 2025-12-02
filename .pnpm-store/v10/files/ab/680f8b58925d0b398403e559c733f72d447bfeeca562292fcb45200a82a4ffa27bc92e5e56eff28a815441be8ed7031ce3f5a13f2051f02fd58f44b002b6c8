// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as EventsAPI from './events';
import { EventCreateParams, EventCreateResponse, Events } from './events';
import * as StatusAPI from './status';
import { Status, StatusEditParams, StatusEditResponse } from './status';
import { SinglePage, V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../../pagination';

export class Instances extends APIResource {
  status: StatusAPI.Status = new StatusAPI.Status(this._client);
  events: EventsAPI.Events = new EventsAPI.Events(this._client);

  /**
   * Create a new workflow instance
   */
  create(
    workflowName: string,
    params: InstanceCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<InstanceCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/workflows/${workflowName}/instances`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: InstanceCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List of workflow instances
   */
  list(
    workflowName: string,
    params: InstanceListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<InstanceListResponsesV4PagePaginationArray, InstanceListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/workflows/${workflowName}/instances`,
      InstanceListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Batch create new Workflow instances
   */
  bulk(
    workflowName: string,
    params: InstanceBulkParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<InstanceBulkResponsesSinglePage, InstanceBulkResponse> {
    const { account_id, body } = params ?? {};
    return this._client.getAPIList(
      `/accounts/${account_id}/workflows/${workflowName}/instances/batch`,
      InstanceBulkResponsesSinglePage,
      { body: body, method: 'post', ...options },
    );
  }

  /**
   * Get logs and status from instance
   */
  get(
    workflowName: string,
    instanceId: string,
    params: InstanceGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<InstanceGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/workflows/${workflowName}/instances/${instanceId}`,
        options,
      ) as Core.APIPromise<{ result: InstanceGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class InstanceListResponsesV4PagePaginationArray extends V4PagePaginationArray<InstanceListResponse> {}

export class InstanceBulkResponsesSinglePage extends SinglePage<InstanceBulkResponse> {}

export interface InstanceCreateResponse {
  id: string;

  status:
    | 'queued'
    | 'running'
    | 'paused'
    | 'errored'
    | 'terminated'
    | 'complete'
    | 'waitingForPause'
    | 'waiting';

  version_id: string;

  workflow_id: string;
}

export interface InstanceListResponse {
  id: string;

  created_on: string;

  ended_on: string | null;

  modified_on: string;

  started_on: string | null;

  status:
    | 'queued'
    | 'running'
    | 'paused'
    | 'errored'
    | 'terminated'
    | 'complete'
    | 'waitingForPause'
    | 'waiting';

  version_id: string;

  workflow_id: string;
}

export interface InstanceBulkResponse {
  id: string;

  status:
    | 'queued'
    | 'running'
    | 'paused'
    | 'errored'
    | 'terminated'
    | 'complete'
    | 'waitingForPause'
    | 'waiting';

  version_id: string;

  workflow_id: string;
}

export interface InstanceGetResponse {
  end: string | null;

  error: InstanceGetResponse.Error | null;

  output: string | number;

  params: unknown;

  queued: string;

  start: string | null;

  status:
    | 'queued'
    | 'running'
    | 'paused'
    | 'errored'
    | 'terminated'
    | 'complete'
    | 'waitingForPause'
    | 'waiting';

  steps: Array<
    | InstanceGetResponse.UnionMember0
    | InstanceGetResponse.UnionMember1
    | InstanceGetResponse.UnionMember2
    | InstanceGetResponse.UnionMember3
  >;

  success: boolean | null;

  trigger: InstanceGetResponse.Trigger;

  versionId: string;
}

export namespace InstanceGetResponse {
  export interface Error {
    message: string;

    name: string;
  }

  export interface UnionMember0 {
    attempts: Array<UnionMember0.Attempt>;

    config: UnionMember0.Config;

    end: string | null;

    name: string;

    output: unknown;

    start: string;

    success: boolean | null;

    type: 'step';
  }

  export namespace UnionMember0 {
    export interface Attempt {
      end: string | null;

      error: Attempt.Error | null;

      start: string;

      success: boolean | null;
    }

    export namespace Attempt {
      export interface Error {
        message: string;

        name: string;
      }
    }

    export interface Config {
      retries: Config.Retries;

      timeout: unknown | number;
    }

    export namespace Config {
      export interface Retries {
        delay: unknown | number;

        limit: number;

        backoff?: 'constant' | 'linear' | 'exponential';
      }
    }
  }

  export interface UnionMember1 {
    end: string;

    error: UnionMember1.Error | null;

    finished: boolean;

    name: string;

    start: string;

    type: 'sleep';
  }

  export namespace UnionMember1 {
    export interface Error {
      message: string;

      name: string;
    }
  }

  export interface UnionMember2 {
    trigger: UnionMember2.Trigger;

    type: 'termination';
  }

  export namespace UnionMember2 {
    export interface Trigger {
      source: string;
    }
  }

  export interface UnionMember3 {
    end: string;

    error: UnionMember3.Error | null;

    finished: boolean;

    name: string;

    output: unknown | string | number | boolean;

    start: string;

    type: 'waitForEvent';
  }

  export namespace UnionMember3 {
    export interface Error {
      message: string;

      name: string;
    }
  }

  export interface Trigger {
    source: 'unknown' | 'api' | 'binding' | 'event' | 'cron';
  }
}

export interface InstanceCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  instance_id?: string;

  /**
   * Body param:
   */
  instance_retention?: unknown;

  /**
   * Body param:
   */
  params?: unknown;
}

export interface InstanceListParams extends V4PagePaginationArrayParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param: Accepts ISO 8601 with no timezone offsets and in UTC.
   */
  date_end?: string;

  /**
   * Query param: Accepts ISO 8601 with no timezone offsets and in UTC.
   */
  date_start?: string;

  /**
   * Query param:
   */
  status?:
    | 'queued'
    | 'running'
    | 'paused'
    | 'errored'
    | 'terminated'
    | 'complete'
    | 'waitingForPause'
    | 'waiting';
}

export interface InstanceBulkParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  body?: Array<InstanceBulkParams.Body>;
}

export namespace InstanceBulkParams {
  export interface Body {
    instance_id?: string;

    instance_retention?: unknown;

    params?: unknown;
  }
}

export interface InstanceGetParams {
  account_id: string;
}

Instances.InstanceListResponsesV4PagePaginationArray = InstanceListResponsesV4PagePaginationArray;
Instances.InstanceBulkResponsesSinglePage = InstanceBulkResponsesSinglePage;
Instances.Status = Status;
Instances.Events = Events;

export declare namespace Instances {
  export {
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
    Status as Status,
    type StatusEditResponse as StatusEditResponse,
    type StatusEditParams as StatusEditParams,
  };

  export {
    Events as Events,
    type EventCreateResponse as EventCreateResponse,
    type EventCreateParams as EventCreateParams,
  };
}
