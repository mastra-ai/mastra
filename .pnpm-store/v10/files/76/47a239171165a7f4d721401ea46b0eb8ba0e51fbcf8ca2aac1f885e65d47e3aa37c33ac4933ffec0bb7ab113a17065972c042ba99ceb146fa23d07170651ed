// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Status extends APIResource {
  /**
   * Change status of instance
   */
  edit(
    workflowName: string,
    instanceId: string,
    params: StatusEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<StatusEditResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/workflows/${workflowName}/instances/${instanceId}/status`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: StatusEditResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface StatusEditResponse {
  status:
    | 'queued'
    | 'running'
    | 'paused'
    | 'errored'
    | 'terminated'
    | 'complete'
    | 'waitingForPause'
    | 'waiting';

  /**
   * Accepts ISO 8601 with no timezone offsets and in UTC.
   */
  timestamp: string;
}

export interface StatusEditParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: Apply action to instance.
   */
  status: 'resume' | 'pause' | 'terminate';
}

export declare namespace Status {
  export { type StatusEditResponse as StatusEditResponse, type StatusEditParams as StatusEditParams };
}
